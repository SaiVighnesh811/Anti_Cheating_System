import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useLockdown } from '../hooks/useLockdown';
import { Clock, AlertTriangle, Send } from 'lucide-react';

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

  // ── UI-only state for dashboard layout ─────────────────────────────────
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [activityLog, setActivityLog] = useState([]);
  const videoRef = useRef(null);
  const timelineEndRef = useRef(null);
  const prevQueueLenRef = useRef(0);
  
  const MAX_VIOLATIONS = 5;

  const { user } = useAuth();
  const { warnings, isWarningVisible, dismissWarning, logViolation, triggerDisqualification } = useAntiCheat(attemptId, examActive && !submitting, user?.role);
  const { toastMessage } = useLockdown(examActive && !submitting);

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
        setExam(examData);
        
        // initialize answers array
        const initialAnswers = examData.questions.map(q => ({
          questionId: q._id,
          selectedOptionIndex: null
        }));
        setAnswers(initialAnswers);

        // calculate time remaining
        const elapsed = (Date.now() - new Date(currentAttempt.startedAt).getTime()) / 1000;
        const totalSeconds = examData.durationMinutes * 60;
        const remaining = Math.max(0, totalSeconds - elapsed);
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

  // Handle Specific Local UI Warnings using a Queue to prevent overwriting
  useEffect(() => {
    if (loading || !exam || !examActive || submitting) return;

    let timeoutId;

    const handleFullscreenChange = () => {
      if (submittingRef.current) return;
      if (!document.fullscreenElement) {
        // Prevent duplicate consecutive warnings in queue
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
        // Small buffer delay to process fullscreen first if it happened just before
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

  // Derive active warning from queue
  const activeWarningType = warningQueue[0];

  // Handle Fullscreen Automatic Recovery Fallback
  useEffect(() => {
    if (activeWarningType === 'fullscreen-exit') {
      const timer = setTimeout(() => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen()
            .then(() => {
              // Proceed to next warning in queue
              setWarningQueue(prev => prev.slice(1));
              dismissWarning();
            })
            .catch(err => {
              console.log("Auto fullscreen failed (requires user gesture). User must click button manually.", err);
            });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeWarningType, dismissWarning]);

  useEffect(() => {
    if (timeLeft === null) return;
    
    if (timeLeft <= 0 && !submitting) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, submitting]);

  // Handle Auto Disqualification
  useEffect(() => {
    if (warnings >= MAX_VIOLATIONS && examActive && !submittingRef.current && !isDisqualifiedLocal) {
      console.log("Max violations reached. Auto disqualifying...");
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
           setTimeout(() => {
             window.location.href = '/student';
           }, 3000);
        })
        .catch((err) => {
           console.error("Auto disqualify submit failed", err);
           setSubmitting(false);
        });
    }
  }, [warnings, examActive, attemptId, answers, dismissWarning, isDisqualifiedLocal, triggerDisqualification]);

  const handleOptionSelect = (qId, optionIndex) => {
    setAnswers(prev => prev.map(a => 
      a.questionId === qId ? { ...a, selectedOptionIndex: optionIndex } : a
    ));
  };

  const handleFinalSubmit = async () => {
    if (submitting || submittingRef.current) return;
    console.log("Submit clicked");
    submittingRef.current = true;
    setSubmitting(true);
    setExamActive(false);
    setWarningQueue([]);
    dismissWarning();
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }
    
    try {
      console.log("Submitting data...");
      const response = await api.post(`/attempts/${attemptId}/submit`, { answers });
      console.log("Submission success", response.data);
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
        .catch(err => {
          console.log("Fullscreen request failed", err);
          // Fallback if browser blocks it initially, let them start it manually anyway
          setExamActive(true);
        });
    } else {
      setExamActive(true);
    }
  };

  // ── Camera feed (UI-only) ───────────────────────────────────────────────
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

  // ── Activity log – seed on start, append on each new queue entry ────────
  useEffect(() => {
    if (examActive) setActivityLog([{ time: new Date(), label: 'Exam started', type: 'start' }]);
  }, [examActive]);

  useEffect(() => {
    if (warningQueue.length > prevQueueLenRef.current) {
      const newType = warningQueue[warningQueue.length - 1];
      setActivityLog(prev => [...prev, {
        time: new Date(),
        label: newType === 'tab-switch' ? 'Tab switch detected' : 'Fullscreen exit',
        type: 'warning'
      }]);
    }
    prevQueueLenRef.current = warningQueue.length;
  }, [warningQueue]);

  // ── Auto-scroll timeline to bottom ─────────────────────────────────────
  useEffect(() => {
    if (timelineEndRef.current) timelineEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activityLog]);

  if (loading || !exam) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Exam Environment...</div>;

  if (isDisqualifiedLocal) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)', animation: 'popupScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'pulseGlow 2s infinite' }}>🚫</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--danger)' }}>Disqualified</h1>
          <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: '500' }}>
            You have been disqualified due to excessive violations.
          </p>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'inline-block' }}>
            <span style={{ fontSize: '1.15rem', color: 'var(--danger)', fontWeight: 'bold' }}>Total Violations: {warnings}</span>
          </div>
          <div>
            <button 
              onClick={() => window.location.href = '/student'} 
              className="btn-primary" 
              style={{ padding: '1rem 3rem', fontSize: '1.1rem', background: 'var(--danger)' }}
              disabled={submitting}
            >
              {submitting ? 'Saving Result...' : 'Return to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!examActive) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{exam.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>{exam.description}</p>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '3rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{exam.durationMinutes}m</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duration</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{exam.questions.length}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Questions</span>
            </div>
          </div>
          <p style={{ color: 'var(--warning)', marginBottom: '2rem', fontSize: '0.9rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            ⚠️ <strong>Secure Action Required:</strong> This exam requires fullscreen. Switching tabs, exiting fullscreen, or minimizing the window will be recorded as cheating violations.
          </p>
          <button onClick={handleStartExam} className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem', background: 'var(--success)' }}>
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = answers.filter(a => a.selectedOptionIndex !== null).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', fontFamily: "'Inter', 'Roboto', sans-serif" }}>

      {/* ─── Dashboard Styles ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .exam-db * { box-sizing: border-box; }

        /* Sticky header */
        .exam-header {
          position: sticky; top: 0; z-index: 100;
          background: #1e293b;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 0 1.25rem; height: 58px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 2px 16px rgba(0,0,0,0.4);
          gap: 1rem;
        }
        .exam-timer {
          display: flex; align-items: center; gap: 0.45rem;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 9px; padding: 0.38rem 0.9rem;
          font-size: 1.1rem; font-weight: 800; font-variant-numeric: tabular-nums;
          color: #e2e8f0; letter-spacing: 0.03em; transition: all 0.3s;
          font-family: 'Inter', monospace;
        }
        .exam-timer.danger {
          background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.45);
          color: #fca5a5; animation: timerPulse 1s ease-in-out infinite;
        }
        @keyframes timerPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.4); }
          50%      { box-shadow:0 0 0 7px rgba(239,68,68,0); }
        }
        .monitored-badge {
          display: flex; align-items: center; gap: 0.4rem;
          background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3);
          border-radius: 999px; padding: 0.28rem 0.75rem;
        }
        .monitored-dot { width:7px; height:7px; border-radius:50%; background:#10b981; animation: mDot 2s ease-in-out infinite; }
        @keyframes mDot { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .finish-btn {
          background:#10b981; color:#fff; border:none; border-radius:8px;
          padding:0.42rem 1.05rem; font-size:0.82rem; font-weight:600;
          cursor:pointer; display:flex; align-items:center; gap:0.4rem;
          transition:all 0.2s; font-family:inherit;
        }
        .finish-btn:hover { background:#059669; transform:translateY(-1px); }
        .finish-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none; }

        /* Main grid */
        .exam-main {
          flex:1; display:grid;
          grid-template-columns: 1fr 290px;
          min-height:0;
        }
        @media (max-width:860px) {
          .exam-main { grid-template-columns:1fr; }
          .exam-sidebar { display:none; }
        }

        /* Left panel */
        .exam-left { overflow-y:auto; padding:1.1rem 1.25rem 5rem; background:#0f172a; }

        /* Question navigator */
        .q-nav {
          display:flex; flex-wrap:wrap; gap:0.35rem; align-items:center;
          padding:0.75rem 0.9rem; background:#1e293b;
          border-radius:11px; border:1px solid rgba(255,255,255,0.06);
          margin-bottom:0.85rem;
        }
        .q-nav-btn {
          width:31px; height:31px; border-radius:7px;
          border:1.5px solid rgba(255,255,255,0.1); background:transparent;
          font-size:0.75rem; font-weight:600; cursor:pointer;
          transition:all 0.15s ease; color:#64748b;
          display:flex; align-items:center; justify-content:center;
          font-family:inherit;
        }
        .q-nav-btn:hover { border-color:#6366f1; color:#a5b4fc; transform:translateY(-1px); }
        .q-nav-btn.answered { background:#6366f1; border-color:#6366f1; color:#fff; }
        .q-nav-btn.current { border-color:#a5b4fc; box-shadow:0 0 0 2px rgba(99,102,241,0.3); color:#a5b4fc; font-weight:700; }
        .q-nav-btn.answered.current { background:#4f46e5; border-color:#a5b4fc; color:#fff; }

        /* Question card */
        .q-card {
          background:#1e293b; border-radius:13px;
          border:2px solid rgba(255,255,255,0.05);
          padding:1.5rem; margin-bottom:0.85rem;
          transition:border-color 0.2s, box-shadow 0.2s;
          cursor:pointer;
        }
        .q-card:hover { border-color:rgba(99,102,241,0.2); }
        .q-card.active { border-color:rgba(99,102,241,0.45); box-shadow:0 0 0 2px rgba(99,102,241,0.1); }

        /* Option */
        .opt-label {
          display:flex; align-items:center; gap:0.8rem;
          padding:0.75rem 0.9rem; border-radius:9px;
          border:1.5px solid rgba(255,255,255,0.08);
          background:rgba(255,255,255,0.02);
          cursor:pointer; transition:all 0.18s ease;
          margin-bottom:0.45rem; font-size:0.92rem; color:#94a3b8;
          font-family:inherit;
        }
        .opt-label:hover { border-color:#6366f1; background:rgba(99,102,241,0.08); color:#c7d2fe; transform:translateX(2px); }
        .opt-label.selected { border-color:#6366f1; background:rgba(99,102,241,0.15); color:#a5b4fc; font-weight:500; }

        /* Sidebar */
        .exam-sidebar {
          background:#1a2234; border-left:1px solid rgba(255,255,255,0.06);
          display:flex; flex-direction:column; overflow-y:auto;
        }
        .sb-card { padding:0.9rem 1rem; border-bottom:1px solid rgba(255,255,255,0.05); }
        .sb-title {
          font-size:0.65rem; font-weight:700; text-transform:uppercase;
          letter-spacing:0.1em; color:#475569; margin:0 0 0.65rem;
          display:flex; align-items:center; gap:0.4rem;
        }

        /* Camera */
        .cam-box {
          width:100%; aspect-ratio:4/3; background:#0f172a;
          border-radius:9px; overflow:hidden; position:relative;
          border:1px solid rgba(255,255,255,0.07);
        }
        .cam-box video { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); }
        .cam-badge {
          position:absolute; top:7px; left:7px;
          background:rgba(0,0,0,0.65); backdrop-filter:blur(6px);
          color:#fff; font-size:0.6rem; font-weight:700; letter-spacing:0.08em;
          padding:0.18rem 0.5rem; border-radius:999px;
          display:flex; align-items:center; gap:0.3rem;
        }
        .live-dot { width:6px; height:6px; border-radius:50%; background:#ef4444; animation:liveBlink 1.2s ease-in-out infinite; }
        @keyframes liveBlink { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        .cam-no-feed {
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:0.4rem;
          color:#334155; font-size:0.75rem; font-weight:500;
        }

        /* Violations */
        .viol-count { font-size:2.4rem; font-weight:800; line-height:1; }
        .viol-bar-track { height:5px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden; width:100%; margin-top:0.3rem; }
        .viol-bar-fill { height:100%; border-radius:3px; transition:all 0.4s; }

        /* Timeline */
        .tl-scroll { max-height:210px; overflow-y:auto; display:flex; flex-direction:column; }
        .tl-item {
          display:flex; gap:0.45rem; padding:0.42rem 0;
          border-bottom:1px solid rgba(255,255,255,0.04);
          animation:tlFade 0.3s ease;
        }
        @keyframes tlFade { from{opacity:0;transform:translateY(4px);} to{opacity:1;transform:translateY(0);} }
        .tl-dot { width:7px; height:7px; border-radius:50%; margin-top:4px; flex-shrink:0; }
        .tl-time { font-size:0.62rem; color:#475569; font-weight:600; white-space:nowrap; min-width:36px; padding-top:1px; }
        .tl-label { font-size:0.72rem; color:#64748b; line-height:1.35; }
      `}</style>

      {/* ══════════ WARNING OVERLAYS — UNCHANGED ══════════ */}
      {activeWarningType && (
        <div className="warning-overlay">
          {activeWarningType === 'tab-switch' && (
            <div className="glass-panel warning-modal warning-popup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AlertTriangle size={64} color="var(--danger)" style={{ marginBottom: '1.5rem' }} />
              <h2 style={{ fontSize: '2rem', color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>Suspicious Activity</h2>
              <p style={{ fontSize: '1.3rem', marginBottom: '2rem', color: 'var(--text-primary)', textAlign: 'center', fontWeight: '600' }}>
                🚫 Tab switching is violated.
              </p>
              <button
                onClick={() => { setWarningQueue(prev => prev.slice(1)); dismissWarning(); }}
                className="btn-primary"
                style={{ width: '100%', background: 'var(--danger)', fontSize: '1.2rem', padding: '1rem' }}
              >
                OK, Continue Exam
              </button>
            </div>
          )}
          {activeWarningType === 'fullscreen-exit' && (
            <div className="glass-panel warning-modal warning-popup" style={{ border: '1px solid rgba(245,158,11,0.5)', animation: 'pulseGlow 2s infinite', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AlertTriangle size={64} color="var(--warning)" style={{ marginBottom: '1.5rem' }} />
              <h2 style={{ fontSize: '2rem', color: 'var(--warning)', marginBottom: '1rem', textAlign: 'center' }}>Fullscreen Required</h2>
              <p style={{ fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--text-primary)', textAlign: 'center', fontWeight: '600' }}>⚠️ Fullscreen mode is required.</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center' }}>Re-entering automatically in 3s... (or click below)</p>
              <button
                onClick={() => { setWarningQueue(prev => prev.slice(1)); dismissWarning(); const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen().catch(e => console.log(e)); }}
                className="btn-primary"
                style={{ width: '100%', background: 'var(--warning)', color: '#000', fontSize: '1.2rem', padding: '1rem', boxShadow: '0 0 15px rgba(245,158,11,0.5)' }}
                onMouseOver={e => e.currentTarget.style.boxShadow = '0 0 25px rgba(245,158,11,0.8)'}
                onMouseOut={e => e.currentTarget.style.boxShadow = '0 0 15px rgba(245,158,11,0.5)'}
              >
                Re-enter Fullscreen
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════ STICKY HEADER ══════════ */}
      <header className="exam-header exam-db">
        {/* Left: Timer */}
        <div className={`exam-timer ${timeLeft < 300 ? 'danger' : ''}`}>
          <Clock size={15} />
          <span>{formatTime(timeLeft)}</span>
        </div>

        {/* Center: Exam title + candidate */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exam.title}</div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px' }}>{user?.name || 'Candidate'}</div>
        </div>

        {/* Right: Status + Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          <div className="monitored-badge">
            <span className="monitored-dot" />
            <span style={{ fontSize: '0.67rem', fontWeight: '700', color: '#10b981', letterSpacing: '0.07em' }}>MONITORED</span>
          </div>
          <button
            className="finish-btn"
            onClick={() => { if (window.confirm('Are you sure you want to finish the exam early?')) handleFinalSubmit(); }}
            disabled={submitting}
          >
            <Send size={13} />
            {submitting ? 'Submitting...' : 'Finish Exam'}
          </button>
        </div>
      </header>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <div className="exam-main exam-db">

        {/* LEFT — Question Panel */}
        <div className="exam-left">

          {/* Question Navigator */}
          <div className="q-nav">
            <span style={{ fontSize: '0.68rem', fontWeight: '600', color: '#475569', marginRight: '0.2rem', whiteSpace: 'nowrap' }}>Questions:</span>
            {exam.questions.map((q, idx) => {
              const isAnswered = answers.find(a => a.questionId === q._id)?.selectedOptionIndex !== null;
              const isCurrent = idx === currentQuestion;
              return (
                <button
                  key={idx}
                  className={`q-nav-btn${isAnswered ? ' answered' : ''}${isCurrent ? ' current' : ''}`}
                  onClick={() => {
                    setCurrentQuestion(idx);
                    document.getElementById(`q-block-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#475569', whiteSpace: 'nowrap' }}>
              {answeredCount}/{exam.questions.length} done
            </span>
          </div>

          {/* Instructions */}
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>📋</span>
            <span>{exam.description}</span>
          </div>

          {/* Questions */}
          {exam.questions.map((q, qIndex) => {
            const isActive = qIndex === currentQuestion;
            return (
              <div
                key={q._id}
                id={`q-block-${qIndex}`}
                className={`q-card${isActive ? ' active' : ''}`}
                onClick={() => setCurrentQuestion(qIndex)}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
                  <span style={{ width: '26px', height: '26px', borderRadius: '7px', background: isActive ? '#6366f1' : 'rgba(255,255,255,0.06)', color: isActive ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0 }}>
                    {qIndex + 1}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.97rem', lineHeight: '1.65', color: '#e2e8f0', fontWeight: '500', paddingTop: '2px' }}>
                    {q.questionText}
                  </p>
                </div>
                <div style={{ paddingLeft: '2.6rem' }}>
                  {q.options.map((opt, optIndex) => {
                    const isSelected = answers.find(a => a.questionId === q._id)?.selectedOptionIndex === optIndex;
                    return (
                      <label key={optIndex} className={`opt-label${isSelected ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name={`q-${q._id}`}
                          checked={isSelected}
                          onChange={() => handleOptionSelect(q._id, optIndex)}
                          style={{ width: '15px', height: '15px', accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT — Monitoring Sidebar */}
        <aside className="exam-sidebar">

          {/* Camera Feed */}
          <div className="sb-card">
            <p className="sb-title">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              Live Monitoring
            </p>
            <div className="cam-box">
              <video ref={videoRef} autoPlay muted playsInline />
              <div className="cam-badge"><span className="live-dot" /> LIVE</div>
              {/* Fallback shown when camera ref has no stream — CSS hides if video has content */}
            </div>
          </div>

          {/* Violations Count */}
          <div className="sb-card">
            <p className="sb-title">
              <AlertTriangle size={10} color="#ef4444" />
              Violations
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="viol-count" style={{ color: warnings === 0 ? '#10b981' : warnings >= 3 ? '#ef4444' : '#f59e0b' }}>
                {warnings}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {warnings === 0 ? 'Clean session' : `${MAX_VIOLATIONS - warnings} left before disqualification`}
                </div>
                <div className="viol-bar-track">
                  <div
                    className="viol-bar-fill"
                    style={{ width: `${Math.min(100, (warnings / MAX_VIOLATIONS) * 100)}%`, background: warnings >= 4 ? '#ef4444' : warnings >= 2 ? '#f59e0b' : '#10b981' }}
                  />
                </div>
              </div>
            </div>
            {warnings > 0 && (
              <div style={{ marginTop: '0.55rem', padding: '0.35rem 0.6rem', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', fontSize: '0.68rem', color: '#fca5a5' }}>
                ⚠️ {MAX_VIOLATIONS - warnings} more violation(s) = auto-disqualification
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="sb-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <p className="sb-title">🕐 Activity Timeline</p>
            <div className="tl-scroll">
              {activityLog.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: '#334155', textAlign: 'center', padding: '1rem 0' }}>No events yet</div>
              ) : (
                activityLog.map((entry, i) => (
                  <div key={i} className="tl-item">
                    <div className="tl-dot" style={{ background: entry.type === 'warning' ? '#ef4444' : entry.type === 'safe' ? '#10b981' : '#6366f1' }} />
                    <div className="tl-time">{entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="tl-label">{entry.label}</div>
                  </div>
                ))
              )}
              <div ref={timelineEndRef} />
            </div>
          </div>

        </aside>
      </div>

      {/* ══════════ LOCKDOWN TOAST — UNCHANGED ══════════ */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(12px)',
          color: '#fff', padding: '0.85rem 1.4rem', borderRadius: '12px',
          fontSize: '0.95rem', fontWeight: '600', zIndex: 9999,
          boxShadow: '0 8px 32px rgba(239,68,68,0.4)',
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'fadeIn 0.2s ease-out', maxWidth: '340px',
          letterSpacing: '0.01em', pointerEvents: 'none'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default TakeExam;
