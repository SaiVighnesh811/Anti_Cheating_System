import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useLockdown } from '../hooks/useLockdown';
import { Clock, AlertTriangle, Send, Eye, CheckCircle, Info, RefreshCw } from 'lucide-react';

const TakeExam = () => {
  const { id: attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [warningQueue, setWarningQueue] = useState([]);
  const [examActive, setExamActive] = useState(false);
  const [isDisqualifiedLocal, setIsDisqualifiedLocal] = useState(false);
  const submittingRef = useRef(false);

  // ── UI-only state ───────────────────────────────────────────────────────
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [activityLog, setActivityLog] = useState([]);
  const [timerTick, setTimerTick] = useState(false);
  const [showViolationGlow, setShowViolationGlow] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  // Theme state
  const [isDarkMode] = useState(() => {
    const saved = localStorage.getItem('student-theme');
    return saved === 'dark';
  });

  const videoRef = useRef(null);
  const timelineEndRef = useRef(null);
  const prevQueueLenRef = useRef(0);

  const MAX_VIOLATIONS = 5;

  const { user } = useAuth();
  const { warnings, isWarningVisible, dismissWarning, logViolation, triggerDisqualification } = useAntiCheat(attemptId, examActive && !submitting, user?.role);
  const { toastMessage: lockdownToast } = useLockdown(examActive && !submitting);

  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        const { data: attemptData } = await api.get('/attempts/my-attempts');
        const currentAttempt = attemptData.find(a => a._id === attemptId);

        if (!currentAttempt) {
          alert('Attempt not found');
          return navigate('/student');
        }

        if (currentAttempt.status !== 'in-progress') {
          alert('This exam attempt is already completed.');
          return navigate('/student');
        }

        setAttempt(currentAttempt);
        const { data: examData } = await api.get(`/exams/${currentAttempt.exam._id}`);

        if (examData.endTime && new Date() > new Date(examData.endTime)) {
          alert('This exam has ended');
          return navigate('/student');
        }

        setExam(examData);

        const initialAnswers = examData.questions.map(q => ({
          questionId: q._id,
          selectedOptionIndex: null,
          fillText: ''
        }));
        setAnswers(initialAnswers);

        // TIMER FIX: remaining = examEndTime - now, where examEndTime = startTime + duration
        // This ensures late starters get LESS time, not the full duration
        let examEndMs;
        if (examData.endTime) {
          examEndMs = new Date(examData.endTime).getTime();
        } else if (examData.startTime && examData.durationMinutes) {
          examEndMs = new Date(examData.startTime).getTime() + (examData.durationMinutes * 60000);
        } else {
          // No scheduled window set — give full duration from student's own start
          examEndMs = new Date(currentAttempt.startedAt).getTime() + (examData.durationMinutes * 60000);
        }
        const remaining = Math.max(0, (examEndMs - Date.now()) / 1000);
        setTimeLeft(Math.floor(remaining));

      } catch (err) {
        console.error('Error fetching exam', err);
        navigate('/student');
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [attemptId, navigate]);

  // Anti-cheat listeners (Logic Unchanged)
  useEffect(() => {
    if (loading || !exam || !examActive || submitting) return;

    let timeoutId;
    const handleFullscreenChange = () => {
      if (submittingRef.current) return;
      if (!document.fullscreenElement) {
        setWarningQueue(prev => {
          if (prev[prev.length - 1] === 'fullscreen-exit') return prev;
          return [...prev, 'fullscreen-exit'];
        });
        logViolation('fullscreen-exit');
      }
    };

    const handleVisibility = () => {
      if (submittingRef.current) return;
      if (document.hidden) {
        timeoutId = setTimeout(() => {
          setWarningQueue(prev => {
            if (prev[prev.length - 1] === 'tab-switch') return prev;
            return [...prev, 'tab-switch'];
          });
        }, 200);
      }
    };

    const handleBlur = () => {
      if (submittingRef.current) return;
      if (document.fullscreenElement) {
        setWarningQueue(prev => {
          if (prev[prev.length - 1] === 'tab-switch') return prev;
          return [...prev, 'tab-switch'];
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [loading, exam, attemptId, examActive, submitting, logViolation]);

  const activeWarningType = warningQueue[0];

  useEffect(() => {
    if (activeWarningType === 'fullscreen-exit') {
      const timer = setTimeout(() => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen()
            .then(() => {
              setWarningQueue(prev => prev.slice(1));
              dismissWarning();
            })
            .catch(err => console.log("Auto fullscreen failed", err));
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeWarningType, dismissWarning]);

  // Timer loop
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0 && !submitting) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      const nowMs = Date.now();

      // Compute global exam window end
      let finalEndMs;
      if (exam?.endTime) {
        finalEndMs = new Date(exam.endTime).getTime();
      } else if (exam?.startTime && exam?.durationMinutes) {
        finalEndMs = new Date(exam.startTime).getTime() + (exam.durationMinutes * 60000);
      } else {
        finalEndMs = new Date(attempt?.startedAt).getTime() + ((exam?.durationMinutes || 0) * 60000);
      }

      if (nowMs >= finalEndMs && !submitting) {
        clearInterval(timer);
        submittingRef.current = true;
        setSubmitting(true);
        setExamActive(false);
        setWarningQueue([]);
        dismissWarning();

        api.post(`/attempts/${attemptId}/submit`, {
          answers,
          submissionType: 'AUTO_WINDOW_EXPIRY'
        }).then(() => {
          navigate(`/student/review/${attemptId}`);
        }).catch(err => {
          console.error('Auto expiry submission failed', err);
          navigate('/student');
        });
        return;
      }

      // Recompute from wall clock every tick — refresh-safe and drift-free
      const remaining = Math.max(0, Math.floor((finalEndMs - nowMs) / 1000));
      setTimeLeft(remaining);
      setTimerTick(t => !t);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitting, exam, attempt, attemptId, answers, dismissWarning, navigate]);

  // Auto Disqualification (Logic Unchanged)
  useEffect(() => {
    if (warnings >= MAX_VIOLATIONS && examActive && !submittingRef.current && !isDisqualifiedLocal) {
      setIsDisqualifiedLocal(true);
      setExamActive(false);
      triggerDisqualification();
      submittingRef.current = true;
      setSubmitting(true);
      setWarningQueue([]);
      dismissWarning();

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }

      api.post(`/attempts/${attemptId}/submit`, { answers, isDisqualified: true })
        .then(() => {
          setSubmitting(false);
          setTimeout(() => { window.location.href = '/student'; }, 3000);
        })
        .catch(() => setSubmitting(false));
    }
  }, [warnings, examActive, attemptId, answers, dismissWarning, isDisqualifiedLocal, triggerDisqualification]);

  const handleOptionSelect = (qId, optionIndex) => {
    setAnswers(prev => prev.map(a =>
      a.questionId === qId ? { ...a, selectedOptionIndex: optionIndex } : a
    ));
  };

  const handleTextFill = (qId, value) => {
    setAnswers(prev => prev.map(a =>
      a.questionId === qId ? { ...a, fillText: value } : a
    ));
  };

  const handleFinalSubmit = async () => {
    if (submitting || submittingRef.current) return;
    if (!window.confirm('Are you sure you want to submit your exam now? This action cannot be undone.')) return;

    submittingRef.current = true;
    setSubmitting(true);
    setExamActive(false);
    setWarningQueue([]);
    dismissWarning();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }

    try {
      await api.post(`/attempts/${attemptId}/submit`, { answers });
      navigate(`/student/review/${attemptId}`);
    } catch (err) {
      console.error("Submission failed", err);
      submittingRef.current = false;
      setSubmitting(false);
      setExamActive(true);
    }
  };

  const handleStartExam = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
        .then(() => setExamActive(true))
        .catch(() => setExamActive(true));
    } else {
      setExamActive(true);
    }
  };

  // Camera Feed
  useEffect(() => {
    if (!examActive) return;
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.log('Camera unavailable:', err.message);
      }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [examActive]);

  // Activity Log
  useEffect(() => {
    if (examActive) setActivityLog([{ time: new Date(), label: 'Exam Session Started', type: 'start' }]);
  }, [examActive]);

  useEffect(() => {
    if (warningQueue.length > prevQueueLenRef.current) {
      const newType = warningQueue[warningQueue.length - 1];
      const label = newType === 'tab-switch' ? 'Tab Switch Detected' : 'Fullscreen Exit Detected';

      setActivityLog(prev => [...prev, { time: new Date(), label, type: 'warning' }]);

      // Trigger visual feedback
      setShowViolationGlow(true);
      setTimeout(() => setShowViolationGlow(false), 1500);

      setToastNotification({ message: label, type: 'error' });
      setTimeout(() => setToastNotification(null), 4000);
    }
    prevQueueLenRef.current = warningQueue.length;
  }, [warningQueue]);

  useEffect(() => {
    if (timelineEndRef.current) timelineEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activityLog]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = answers.filter(a => a.selectedOptionIndex !== null || (a.fillText && a.fillText.trim().length > 0)).length;

  if (loading || !exam) return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <RefreshCw size={40} className="spin-animation" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
      <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Initializing secure environment...</p>
    </div>
  );

  if (isDisqualifiedLocal) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel" style={{ padding: '4rem 3rem', maxWidth: '600px', textAlign: 'center', border: '1.5px solid var(--danger)' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem', animation: 'violationPop 0.8s' }}>🚫</div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--danger)', fontWeight: '800' }}>Disqualified</h1>
          <p style={{ color: 'var(--text-primary)', marginBottom: '2.5rem', fontSize: '1.25rem', fontWeight: '500', lineHeight: '1.5' }}>
            Submission terminated due to policy violations.
          </p>
          <div style={{ background: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'var(--danger-light)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '1.2rem', color: 'var(--danger)', fontWeight: 'bold' }}>Violations Recorded: {warnings}</span>
          </div>
          <button onClick={() => window.location.href = '/student'} className="btn-primary" style={{ width: '100%', padding: '1.2rem', background: 'var(--danger)' }} disabled={submitting}>
            {submitting ? 'Terminating Session...' : 'Exit Portal'}
          </button>
        </div>
      </div>
    );
  }

  if (!examActive) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel" style={{ padding: '3.5rem', maxWidth: '650px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{exam.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: '1.6' }}>{exam.description}</p>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
            <div style={{ background: 'var(--primary-light)', padding: '1.25rem', borderRadius: '16px', minWidth: '120px', border: '1px solid rgba(13,148,136,0.1)' }}>
              <span style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: 'var(--primary)' }}>{exam.durationMinutes}m</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Allowed</span>
            </div>
            <div style={{ background: 'var(--primary-light)', padding: '1.25rem', borderRadius: '16px', minWidth: '120px', border: '1px solid rgba(13,148,136,0.1)' }}>
              <span style={{ display: 'block', fontSize: '1.75rem', fontWeight: '800', color: 'var(--primary)' }}>{exam.questions.length}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Questions</span>
            </div>
          </div>

          {(exam.startTime || exam.endTime) && (
            <div style={{ marginBottom: '2.5rem', background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1.5px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Window</h4>
              {exam.startTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  <span style={{ opacity: 0.6 }}>Starts:</span> <strong>{new Date(exam.startTime).toLocaleString()}</strong>
                </div>
              )}
              {exam.endTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  <span style={{ opacity: 0.6 }}>Ends:</span> <strong>{new Date(exam.endTime).toLocaleString()}</strong>
                </div>
              )}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: '600' }}>
                * Exam session will automatically terminate at the "Ends" time even if your individual timer is active.
              </p>
            </div>
          )}

          <div style={{ textAlign: 'left', background: isDarkMode ? 'rgba(245,158,11,0.08)' : 'var(--warning-light)', padding: '1.5rem', borderRadius: '14px', marginBottom: '3rem', borderLeft: '5px solid var(--warning)' }}>
            <h3 style={{ color: 'var(--warning)', fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} /> Secure Session Rules
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              <li>Fullscreen mode will be enforced automatically.</li>
              <li>Exiting fullscreen or switching tabs will be recorded.</li>
              <li>{MAX_VIOLATIONS} violations will result in <strong>automatic disqualification</strong>.</li>
            </ul>
          </div>

          <button onClick={handleStartExam} className="btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem', fontWeight: '700' }}>
            Initialize Exam Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-theme-provider" style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dashboard)',
      color: 'var(--text-primary)',
      transition: 'all 0.3s ease',
      fontFamily: "'Inter', sans-serif",
      position: 'relative'
    }}>
      <style>{`
        .student-theme-provider {
          --bg-dashboard: ${isDarkMode ? '#0f172a' : '#f8fafc'};
          --surface-panel: ${isDarkMode ? '#1e293b' : '#ffffff'};
          --surface-card: ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
          --card-hover: ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9'};
          --text-primary: ${isDarkMode ? '#f1f5f9' : '#1e293b'};
          --text-secondary: ${isDarkMode ? '#94a3b8' : '#64748b'};
          --text-muted: ${isDarkMode ? '#64748b' : '#94a3b8'};
          --surface-border: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'};
          --card-shadow: ${isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.03)'};
        }

        .glass-panel {
          background: var(--surface-panel) !important;
          border: 1px solid var(--surface-border) !important;
          box-shadow: var(--card-shadow) !important;
        }

        @keyframes screenGlowAnim {
          0% { box-shadow: inset 0 0 0px 0px rgba(239, 68, 68, 0); }
          50% { box-shadow: inset 0 0 100px 20px rgba(239, 68, 68, 0.2); }
          100% { box-shadow: inset 0 0 0px 0px rgba(239, 68, 68, 0); }
        }
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* ── Visual Feedback Overlays ── */}
        {showViolationGlow && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none', animation: 'screenGlowAnim 1.5s forwards' }} />
        )}

        {/* ── Warning Modals (Logic Unchanged) ── */}
        {activeWarningType && (
          <div className="warning-overlay">
            <div className={`glass-panel warning-modal warning-popup ${activeWarningType === 'tab-switch' ? 'warning-shake' : ''}`} style={{ border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <AlertTriangle size={80} color={activeWarningType === 'tab-switch' ? 'var(--danger)' : 'var(--warning)'} style={{ marginBottom: '1.5rem' }} />
              <h2 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                {activeWarningType === 'tab-switch' ? 'Policy Violation' : 'Session Interrupted'}
              </h2>
              <p style={{ fontSize: '1.2rem', marginBottom: '2.5rem', color: 'var(--text-secondary)', fontWeight: '500', lineHeight: '1.4' }}>
                {activeWarningType === 'tab-switch'
                  ? 'Unauthorized tab or window switch detected.'
                  : 'Steady focus required. Fullscreen mode must be maintained.'}
              </p>
              <button
                onClick={() => { setWarningQueue(prev => prev.slice(1)); dismissWarning(); if (activeWarningType === 'fullscreen-exit') document.documentElement.requestFullscreen().catch(e => console.log(e)); }}
                className="btn-primary"
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', background: activeWarningType === 'tab-switch' ? 'var(--danger)' : 'var(--warning)' }}
              >
                Resume Secure Session
              </button>
            </div>
          </div>
        )}

        {/* ── Sticky Header ── */}
        <header className="glass-panel" style={{ position: 'sticky', top: 0, zIndex: 100, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '0 2rem', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div className={`violation-counter ${timeLeft < 300 ? 'active-pulse' : ''}`} style={{ background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary-light)', color: timeLeft < 300 ? 'var(--danger)' : 'var(--primary)', borderColor: timeLeft < 300 ? 'var(--danger)' : 'var(--primary)', transition: 'none' }}>
              <Clock size={18} style={{ animation: 'timerTick 1s infinite' }} />
              <span style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>{formatTime(timeLeft)}</span>
            </div>

          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{exam.title}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>Candidate: {user?.name}</span>
          </div>

          <button className="btn-primary" onClick={handleFinalSubmit} disabled={submitting} style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
            <Send size={16} /> Final Submission
          </button>
        </header>

        {/* ── Main Layout ── */}
        <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', padding: '2rem', gap: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>

          {/* Left: Questions Section */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Question Navigator */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginRight: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions</span>
              {exam.questions.map((q, idx) => {
                const ansState = answers.find(a => a.questionId === q._id);
                const isAnswered = ansState && (ansState.selectedOptionIndex !== null || (ansState.fillText && ansState.fillText.trim().length > 0));
                const isCurrent = idx === currentQuestion;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestion(idx)}
                    style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: isCurrent ? 'var(--primary)' : isAnswered ? 'var(--primary-light)' : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                      color: isCurrent ? '#fff' : isAnswered ? 'var(--primary)' : 'var(--text-muted)',
                      border: '1.5px solid',
                      borderColor: isCurrent ? 'var(--primary)' : isAnswered ? 'var(--primary)' : 'var(--surface-border)',
                      boxShadow: isCurrent ? '0 4px 12px rgba(13,148,136,0.3)' : 'none'
                    }}
                    onMouseOver={e => !isCurrent && (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onMouseOut={e => !isCurrent && (e.currentTarget.style.borderColor = isAnswered ? 'var(--primary)' : 'rgba(0,0,0,0.06)')}
                  >
                    {idx + 1}
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                Progress: {answeredCount} / {exam.questions.length}
              </div>
            </div>

            {/* Current Question Block */}
            <div className="glass-panel" key={currentQuestion} style={{ padding: '3rem', minHeight: '400px', animation: 'qFadeIn 0.5s ease-out' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <span style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', flexShrink: 0 }}>
                  {currentQuestion + 1}
                </span>
                <div style={{ flex: 1 }}>
                  {exam.questions[currentQuestion].questionText && (
                    <h3 style={{ margin: 0, fontSize: '1.35rem', lineHeight: '1.5', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {exam.questions[currentQuestion].questionText}
                    </h3>
                  )}
                  {exam.questions[currentQuestion].questionImage && (
                    <img src={exam.questions[currentQuestion].questionImage} alt="Problem statement" style={{ marginTop: '1rem', maxWidth: '100%', borderRadius: '12px', border: '1.5px solid var(--surface-border)' }} />
                  )}
                </div>
              </div>

              <div style={{ paddingLeft: '4rem' }}>
                {exam.questions[currentQuestion].type === 'fill-in-blank' ? (
                  <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <input
                      type="text"
                      className="input-field-enhanced"
                      placeholder="Type your exact answer here..."
                      value={answers.find(a => a.questionId === exam.questions[currentQuestion]._id)?.fillText || ''}
                      onChange={(e) => handleTextFill(exam.questions[currentQuestion]._id, e.target.value)}
                      style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', border: '2px solid var(--surface-border)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'white', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '500', transition: 'all 0.2s' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 4px var(--primary-light)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {exam.questions[currentQuestion].options.map((opt, optIndex) => {
                      const isSelected = answers.find(a => a.questionId === exam.questions[currentQuestion]._id)?.selectedOptionIndex === optIndex;
                      const optImg = exam.questions[currentQuestion].optionImages?.[optIndex];
                      return (
                        <label key={optIndex} style={{
                          display: 'flex', alignItems: 'center', gap: '1.1rem',
                          padding: '1.1rem 1.5rem', borderRadius: '12px',
                          border: '2px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--surface-border)',
                          background: isSelected ? 'var(--primary-light)' : (isDarkMode ? 'rgba(255,255,255,0.02)' : '#fbfcfd'),
                          cursor: 'pointer', transition: 'all 0.2s ease',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? '600' : '400'
                        }}
                          onMouseOver={e => !isSelected && (e.currentTarget.style.borderColor = 'rgba(13,148,136,0.3)')}
                          onMouseOut={e => !isSelected && (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.05)')}
                        >
                          <input
                            type="radio"
                            name={`q-${exam.questions[currentQuestion]._id}`}
                            checked={isSelected}
                            onChange={() => handleOptionSelect(exam.questions[currentQuestion]._id, optIndex)}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {opt && <span style={{ fontSize: '1.05rem' }}>{opt}</span>}
                            {optImg && <img src={optImg} alt={`Option ${optIndex + 1}`} style={{ maxWidth: '250px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />}
                          </div>
                          {isSelected && <CheckCircle size={20} color="var(--primary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Nav Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="btn-secondary"
                disabled={currentQuestion === 0}
                onClick={() => setCurrentQuestion(prev => prev - 1)}
                style={{ opacity: currentQuestion === 0 ? 0.4 : 1 }}
              >
                Previous Question
              </button>
              <button
                className="btn-primary"
                onClick={() => currentQuestion < exam.questions.length - 1 ? setCurrentQuestion(prev => prev + 1) : handleFinalSubmit()}
                style={{ minWidth: '180px' }}
              >
                {currentQuestion === exam.questions.length - 1 ? 'Finish Exam' : 'Next Question'}
              </button>
            </div>
          </section>

          {/* Right: Monitoring Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Camera Feed - Hidden visually but functional in background */}
            <div style={{ display: 'none' }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            </div>

            {/* Integrity Metrics */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} /> Integrity Status
              </h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1, color: warnings === 0 ? 'var(--success)' : warnings >= 4 ? 'var(--danger)' : 'var(--warning)', animation: warnings > 0 ? 'violationPop 0.5s' : 'none' }}>
                  {warnings}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingBottom: '0.5rem', fontWeight: '600' }}>
                  TOTAL VIOLATIONS
                </span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '10px', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: warnings >= 4 ? 'var(--danger)' : warnings >= 2 ? 'var(--warning)' : 'var(--success)',
                  width: `${(warnings / MAX_VIOLATIONS) * 100}%`, transition: 'width 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Info size={14} /> {MAX_VIOLATIONS - warnings} violation(s) remaining
              </p>
            </div>

            {/* Activity Timeline */}
            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>Session Timeline</h4>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.5rem' }}>
                {activityLog.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.8rem', animation: 'fadeIn 0.4s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: log.type === 'start' ? 'var(--primary)' : 'var(--danger)', marginTop: '5px' }} />
                      {i < activityLog.length - 1 && <div style={{ width: '1.5px', flex: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700' }}>{log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{log.label}</div>
                    </div>
                  </div>
                ))}
                <div ref={timelineEndRef} />
              </div>
            </div>
          </aside>
        </main>

        {/* ── Toast Notification System ── */}
        {(toastNotification || lockdownToast) && (
          <div style={{
            position: 'fixed', top: '100px', right: '30px',
            background: (toastNotification?.type === 'error' || lockdownToast) ? 'var(--danger)' : 'var(--success)',
            color: '#fff', padding: '1rem 1.8rem', borderRadius: '12px',
            fontSize: '0.95rem', fontWeight: '700', zIndex: 3000,
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            animation: 'toastSlideIn 0.45s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <AlertTriangle size={20} />
            {toastNotification?.message || lockdownToast}
          </div>
        )}
      </div>
    </div>
  );
};

export default TakeExam;
