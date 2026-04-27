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
  const [questionStatuses, setQuestionStatuses] = useState([]);
  const [showRightPanel, setShowRightPanel] = useState(false);
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

        // STRICT TIMER: remaining = exam.endTime - now (late joiners get less time)
        let examEndMs = null;
        if (examData.endTime) {
          examEndMs = new Date(examData.endTime).getTime();
        } else if (examData.startTime && examData.durationMinutes) {
          examEndMs = new Date(examData.startTime).getTime() + (examData.durationMinutes * 60000);
        }

        if (examEndMs && Date.now() > examEndMs) {
          alert('This exam has already ended.');
          return navigate('/student');
        }

        // Store end time on window for timer access
        const remaining = examEndMs ? Math.max(0, Math.floor((examEndMs - Date.now()) / 1000)) : examData.durationMinutes * 60;
        setTimeLeft(remaining);
        setQuestionStatuses(Array(examData.questions.length).fill('not_visited'));

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
      // Always compute remaining from wall clock — drift-free across refreshes
      let finalEndMs = null;
      if (exam?.endTime) {
        finalEndMs = new Date(exam.endTime).getTime();
      } else if (exam?.startTime && exam?.durationMinutes) {
        finalEndMs = new Date(exam.startTime).getTime() + (exam.durationMinutes * 60000);
      }

      const remaining = finalEndMs
        ? Math.max(0, Math.floor((finalEndMs - Date.now()) / 1000))
        : Math.max(0, timeLeft - 1);

      setTimeLeft(remaining);
      setTimerTick(t => !t);

      if (remaining <= 0 && !submitting) {
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
      }
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
    setQuestionStatuses(prev => {
      const newStatuses = [...prev];
      if (newStatuses[currentQuestion] !== 'marked_review' && newStatuses[currentQuestion] !== 'answered_marked_review') {
        newStatuses[currentQuestion] = 'answered';
      } else if (newStatuses[currentQuestion] === 'marked_review') {
        newStatuses[currentQuestion] = 'answered_marked_review';
      }
      return newStatuses;
    });
  };

  const handleTextFill = (qId, value) => {
    setAnswers(prev => prev.map(a =>
      a.questionId === qId ? { ...a, fillText: value } : a
    ));
    // Also mark as answered immediately when typing
    if (value && value.trim().length > 0) {
      setQuestionStatuses(prev => {
        const newStatuses = [...prev];
        if (newStatuses[currentQuestion] !== 'marked_review' && newStatuses[currentQuestion] !== 'answered_marked_review') {
          newStatuses[currentQuestion] = 'answered';
        } else if (newStatuses[currentQuestion] === 'marked_review') {
          newStatuses[currentQuestion] = 'answered_marked_review';
        }
        return newStatuses;
      });
    }
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
        @media (max-width: 1024px) {
          .main-layout { grid-template-columns: 1fr !important; }
          .sidebar-panel { display: var(--show-sidebar, none) !important; flex-direction: column !important; }
          .toggle-sidebar-btn { display: block !important; }
        }
        .toggle-sidebar-btn { display: none; }
        
        .jee-btn-group { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 2rem; border-top: 1px solid var(--surface-border); padding-top: 1.5rem; }
        .jee-btn { padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border: 1px solid;}
        .jee-btn:hover { opacity: 0.85; }
        .btn-save-next { background: var(--success); color: white; border-color: var(--success); }
        .btn-save-review { background: var(--warning); color: white; border-color: var(--warning); }
        .btn-clear { background: transparent; color: var(--text-primary); border-color: var(--surface-border); }
        .btn-review-next { background: var(--primary); color: white; border-color: var(--primary); }
        
        .status-badge { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: var(--text-primary); border: 1px solid var(--surface-border); }
        .status-nv { background: var(--surface-panel); }
        .status-na { background: var(--danger); color: white; border-color: var(--danger); }
        .status-a { background: var(--success); color: white; border-color: var(--success); }
        .status-mr { background: var(--warning); color: white; border-radius: 50%; border-color: var(--warning); }
        .status-amr { background: var(--warning); color: white; border-radius: 50%; position: relative; border-color: var(--warning); }
        .status-amr::after { content: ''; position: absolute; bottom: -2px; right: -2px; width: 10px; height: 10px; background: var(--success); border-radius: 50%; border: 2px solid var(--surface-panel); }

        .palette-btn { width: 42px; height: 42px; display: flex; justify-content: center; align-items: center; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: transform 0.1s; }
        .palette-btn:hover { transform: scale(1.05); }

      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', '--show-sidebar': showRightPanel ? 'flex' : 'none' }}>
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

        {/* ── Sticky Header (JEE Style) ── */}
        <header className="glass-panel" style={{ position: 'sticky', top: 0, zIndex: 100, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '0 2rem', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>{exam.title}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Candidate</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '700' }}>{user?.name}</span>
              </div>
              {user?.profilePhoto ? (
                <img src={user.profilePhoto.startsWith('blob:') ? user.profilePhoto : `http://localhost:5000${user.profilePhoto}`} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-light)' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', border: '2px solid var(--primary-light)' }}>
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
            
            <div className={`violation-counter ${timeLeft < 300 ? 'active-pulse' : ''}`} style={{ background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary-light)', color: timeLeft < 300 ? 'var(--danger)' : 'var(--primary)', borderColor: timeLeft < 300 ? 'var(--danger)' : 'var(--primary)', transition: 'none', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', borderRadius: '8px', border: '1px solid', alignItems: 'center' }}>
              <Clock size={18} style={{ animation: 'timerTick 1s infinite' }} />
              <span style={{ fontSize: '1.25rem', letterSpacing: '0.05em', fontWeight: '700' }}>{formatTime(timeLeft)}</span>
            </div>
            
            <button className="btn-primary-outline toggle-sidebar-btn" onClick={() => setShowRightPanel(!showRightPanel)} style={{ padding: '0.5rem 1rem' }}>
              {showRightPanel ? 'Hide Questions ▲' : 'Show Questions ▼'}
            </button>
          </div>
        </header>

        {/* ── Main Layout ── */}
        <main className="main-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: '70% 30%', padding: '0', maxWidth: '100%', margin: '0', width: '100%', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>

          {/* Left: Questions Section */}
          <section style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--surface-border)', background: 'var(--bg-dashboard)' }}>
            
            {/* Scrollable Question Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
              <div key={currentQuestion} style={{ animation: 'qFadeIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Q{currentQuestion + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    {exam.questions[currentQuestion].questionText && (
                      <h3 style={{ margin: 0, fontSize: '1.2rem', lineHeight: '1.6', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {exam.questions[currentQuestion].questionText}
                      </h3>
                    )}
                    {exam.questions[currentQuestion].questionImage && (
                      <img src={exam.questions[currentQuestion].questionImage} alt="Problem statement" style={{ marginTop: '1.5rem', maxWidth: '100%', borderRadius: '12px', border: '1px solid var(--surface-border)' }} />
                    )}
                  </div>
                </div>

                <div style={{ paddingLeft: '3rem' }}>
                  {exam.questions[currentQuestion].type === 'fill-in-blank' ? (
                    <div>
                      <input
                        type="text"
                        className="input-field-enhanced"
                        placeholder="Type your exact answer here..."
                        value={answers.find(a => a.questionId === exam.questions[currentQuestion]._id)?.fillText || ''}
                        onChange={(e) => handleTextFill(exam.questions[currentQuestion]._id, e.target.value)}
                        style={{ width: '100%', maxWidth: '500px', padding: '1rem', borderRadius: '8px', border: '2px solid var(--surface-border)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'white', color: 'var(--text-primary)', fontSize: '1rem' }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {exam.questions[currentQuestion].options.map((opt, optIndex) => {
                        const isSelected = answers.find(a => a.questionId === exam.questions[currentQuestion]._id)?.selectedOptionIndex === optIndex;
                        const optImg = exam.questions[currentQuestion].optionImages?.[optIndex];
                        return (
                          <label key={optIndex} style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '1rem 1.5rem', borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--surface-border)',
                            background: isSelected ? 'var(--primary-light)' : (isDarkMode ? 'rgba(255,255,255,0.02)' : '#ffffff'),
                            cursor: 'pointer', transition: 'all 0.2s ease',
                            color: 'var(--text-primary)'
                          }}>
                            <input
                              type="radio"
                              name={`q-${exam.questions[currentQuestion]._id}`}
                              checked={isSelected}
                              onChange={() => handleOptionSelect(exam.questions[currentQuestion]._id, optIndex)}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {opt && <span style={{ fontSize: '1rem' }}>{opt}</span>}
                              {optImg && <img src={optImg} alt={`Option ${optIndex + 1}`} style={{ maxWidth: '250px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div style={{ padding: '1.5rem 3rem', background: 'var(--surface-panel)', borderTop: '1px solid var(--surface-border)', zIndex: 10 }}>
              <div className="jee-btn-group" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none' }}>
                <button 
                  className="jee-btn btn-save-next" 
                  onClick={() => {
                    const ans = answers.find(a => a.questionId === exam.questions[currentQuestion]._id);
                    const isAnswered = ans && (ans.selectedOptionIndex !== null || (ans.fillText && ans.fillText.trim().length > 0));
                    setQuestionStatuses(p => { const o = [...p]; o[currentQuestion] = isAnswered ? 'answered' : 'not_answered'; return o; });
                    if(currentQuestion < exam.questions.length - 1) setCurrentQuestion(p => p + 1);
                  }}
                >
                  Save & Next
                </button>
                <button 
                  className="jee-btn btn-clear"
                  onClick={() => {
                    setAnswers(prev => prev.map(a => a.questionId === exam.questions[currentQuestion]._id ? { ...a, selectedOptionIndex: null, fillText: '' } : a));
                    setQuestionStatuses(p => { const o = [...p]; o[currentQuestion] = 'not_answered'; return o; });
                  }}
                >
                  Clear Response
                </button>
                <button 
                  className="jee-btn btn-save-review"
                  onClick={() => {
                    const ans = answers.find(a => a.questionId === exam.questions[currentQuestion]._id);
                    const isAnswered = ans && (ans.selectedOptionIndex !== null || (ans.fillText && ans.fillText.trim().length > 0));
                    setQuestionStatuses(p => { const o = [...p]; o[currentQuestion] = isAnswered ? 'answered_marked_review' : 'marked_review'; return o; });
                    if(currentQuestion < exam.questions.length - 1) setCurrentQuestion(p => p + 1);
                  }}
                >
                  Save & Mark for Review
                </button>
                <button 
                  className="jee-btn btn-review-next"
                  onClick={() => {
                    setQuestionStatuses(p => { const o = [...p]; o[currentQuestion] = 'marked_review'; return o; });
                    if(currentQuestion < exam.questions.length - 1) setCurrentQuestion(p => p + 1);
                  }}
                >
                  Mark for Review & Next
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(p => p - 1)} style={{ padding: '0.5rem 1rem' }}>
                    &lt;&lt; Back
                  </button>
                  <button className="btn-secondary" disabled={currentQuestion === exam.questions.length - 1} onClick={() => setCurrentQuestion(p => p + 1)} style={{ padding: '0.5rem 1rem' }}>
                    Next &gt;&gt;
                  </button>
                </div>
                <button className="btn-primary" onClick={handleFinalSubmit} disabled={submitting} style={{ padding: '0.5rem 2rem' }}>
                  Submit
                </button>
              </div>
            </div>
          </section>

          {/* Right: Monitoring Sidebar & Palette */}
          <aside className="sidebar-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-panel)', overflowY: 'auto' }}>
            
            {/* Legend */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  <div className="status-badge status-nv"></div> Not Visited
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  <div className="status-badge status-na"></div> Not Answered
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  <div className="status-badge status-a"></div> Answered
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  <div className="status-badge status-mr"></div> Marked for Review
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500', gridColumn: '1 / -1' }}>
                  <div className="status-badge status-amr"></div> Answered & Marked for Review (will be considered for evaluation)
                </div>
              </div>
            </div>

            {/* Question Palette Grid */}
            <div style={{ padding: '1.5rem', flex: 1 }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '1rem', background: 'var(--primary-light)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--primary)' }}>
                {exam.subject || 'Exam'} Questions
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: '0.5rem' }}>
                {exam.questions.map((q, idx) => {
                  const s = questionStatuses[idx] || 'not_visited';
                  let badgeClass = 'status-nv';
                  if (s === 'not_answered') badgeClass = 'status-na';
                  if (s === 'answered') badgeClass = 'status-a';
                  if (s === 'marked_review') badgeClass = 'status-mr';
                  if (s === 'answered_marked_review') badgeClass = 'status-amr';
                  
                  return (
                    <div 
                      key={idx} 
                      className={`status-badge palette-btn ${badgeClass}`} 
                      style={{ border: currentQuestion === idx ? '2px solid var(--text-primary)' : '' }}
                      onClick={() => setCurrentQuestion(idx)}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Anti Cheat Monitoring below Palette */}
            <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
               <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} /> Integrity Status
              </h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, color: warnings === 0 ? 'var(--success)' : warnings >= 4 ? 'var(--danger)' : 'var(--warning)' }}>
                  {warnings}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: '0.25rem', fontWeight: '600' }}>VIOLATIONS</span>
              </div>
              <div style={{ height: '6px', background: 'var(--surface-border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: warnings >= 4 ? 'var(--danger)' : warnings >= 2 ? 'var(--warning)' : 'var(--success)',
                  width: `${(warnings / MAX_VIOLATIONS) * 100}%`, transition: 'width 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }} />
              </div>
            </div>

            <div style={{ display: 'none' }}>
              <video ref={videoRef} autoPlay muted playsInline />
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
