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
  
  const { warnings, isWarningVisible, dismissWarning } = useAntiCheat(attemptId, !submitting);

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
    
    try {
      await api.post(`/attempts/${attemptId}/submit`, { answers });
      alert('Exam submitted successfully!');
      navigate('/student');
    } catch (err) {
      alert('Error submitting exam: ' + (err.response?.data?.message || err.message));
      setSubmitting(false);
    }
  };

  if (loading || !exam) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Exam Environment...</div>;

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

      {/* Warning Full Screen Overlay */}
      {isWarningVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertTriangle size={64} color="var(--danger)" style={{ margin: '0 auto 1.5rem auto' }} />
            <h2 style={{ fontSize: '2rem', color: 'var(--danger)', marginBottom: '1rem' }}>Warning!</h2>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'var(--text-primary)' }}>
              We detected suspicious activity (such as switching tabs or minimizing the window). This violation has been logged to the server.
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--warning)', fontWeight: '600', marginBottom: '2.5rem' }}>
              Total Warnings: {warnings}
            </p>
            <button onClick={dismissWarning} className="btn-primary" style={{ width: '100%' }}>
              I Understand, Return to Exam
            </button>
          </div>
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
