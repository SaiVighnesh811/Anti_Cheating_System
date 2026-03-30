import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAntiCheat } from '../hooks/useAntiCheat';
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
  
  const { warnings, isWarningVisible, dismissWarning, logViolation } = useAntiCheat(attemptId, examActive && !submitting);

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

  const handleOptionSelect = (qId, optionIndex) => {
    setAnswers(prev => prev.map(a => 
      a.questionId === qId ? { ...a, selectedOptionIndex: optionIndex } : a
    ));
  };

  const handleFinalSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setExamActive(false);
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }
    
    try {
      await api.post(`/attempts/${attemptId}/submit`, { answers });
      navigate(`/student/review/${attemptId}`);
    } catch (err) {
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

  if (loading || !exam) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Exam Environment...</div>;

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

  return (
    <div style={{ padding: '0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <div style={{ background: 'var(--surface-color)', backdropFilter: 'blur(16px)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>{exam.title}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ID: {attemptId}</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className={`violation-counter ${activeWarningType ? 'active-pulse' : ''}`}>
            Violations: {warnings} 🚨
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)', padding: '0.5rem 1rem', borderRadius: '8px', color: timeLeft < 300 ? 'var(--danger)' : 'var(--text-primary)', transition: 'all 0.3s' }}>
            <Clock size={20} />
            <span style={{ fontSize: '1.2rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{formatTime(timeLeft)}</span>
          </div>
          
          <button 
            onClick={() => { if(window.confirm('Are you sure you want to finish the exam early?')) handleFinalSubmit() }} 
            className="btn-primary" 
            style={{ padding: '0.6rem 1.5rem', background: 'var(--success)' }}
            disabled={submitting}
          >
            <Send size={18} /> {submitting ? 'Submitting...' : 'Finish Exam'}
          </button>
        </div>
      </div>

      {/* Custom Smart Warning Overlays (Requires "OK, Continue Exam" acknowledgment) */}
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
                onClick={() => { 
                  setWarningQueue(prev => prev.slice(1)); 
                  dismissWarning(); 
                }} 
                className="btn-primary" 
                style={{ width: '100%', background: 'var(--danger)', fontSize: '1.2rem', padding: '1rem' }}
              >
                OK, Continue Exam
              </button>
            </div>
          )}

          {activeWarningType === 'fullscreen-exit' && (
            <div className="glass-panel warning-modal warning-popup" style={{ border: '1px solid rgba(245, 158, 11, 0.5)', animation: 'pulseGlow 2s infinite', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AlertTriangle size={64} color="var(--warning)" style={{ marginBottom: '1.5rem' }} />
              <h2 style={{ fontSize: '2rem', color: 'var(--warning)', marginBottom: '1rem', textAlign: 'center' }}>Fullscreen Required</h2>
              <p style={{ fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--text-primary)', textAlign: 'center', fontWeight: '600' }}>
                ⚠️ Fullscreen mode is required.
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center' }}>
                Re-entering automatically in 3s... (or click below)
              </p>
              <button 
                onClick={() => {
                  setWarningQueue(prev => prev.slice(1));
                  dismissWarning();
                  const elem = document.documentElement;
                  if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(err => console.log(err));
                  }
                }} 
                className="btn-primary" 
                style={{ width: '100%', background: 'var(--warning)', color: '#000', fontSize: '1.2rem', padding: '1rem', boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.8)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.5)'}
              >
                Re-enter Fullscreen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="page-container" style={{ maxWidth: '900px', flex: 1, padding: '2rem' }}>
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Instructions</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{exam.description}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          {exam.questions.map((q, qIndex) => (
            <div key={q._id} className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'var(--primary)', color: 'white', borderRadius: '50%', fontWeight: '600', flexShrink: 0 }}>
                  {qIndex + 1}
                </span>
                <h3 style={{ fontSize: '1.15rem', lineHeight: '1.5', margin: 0, paddingTop: '3px' }}>
                  {q.questionText}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '3rem' }}>
                {q.options.map((opt, optIndex) => {
                  const isSelected = answers.find(a => a.questionId === q._id)?.selectedOptionIndex === optIndex;
                  
                  return (
                    <label 
                      key={optIndex} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '1rem', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input 
                        type="radio" 
                        name={`q-${q._id}`} 
                        checked={isSelected}
                        onChange={() => handleOptionSelect(q._id, optIndex)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '1rem' }}>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TakeExam;
