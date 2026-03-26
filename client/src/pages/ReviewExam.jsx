import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, BarChart2 } from 'lucide-react';

const ReviewExam = () => {
  const { id: attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await api.get(`/attempts/${attemptId}/review`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReview();
  }, [attemptId]);

  if (loading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Exam Review...</div>;
  if (error) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--danger)' }}>{error}</div>;

  const { attempt, violations } = data;
  const exam = attempt.exam;

  const totalQuestions = exam.questions.length;
  // Use backend score if accurate, but let's calculate here manually for UI certainty
  let correctCount = 0;
  let wrongCount = 0;

  const getQuestionReview = (questionId) => {
    const question = exam.questions.find(q => q._id === questionId);
    const answer = attempt.answers.find(a => a.questionId === questionId);
    if (!question) return null;

    const isCorrect = answer && answer.selectedOptionIndex === question.correctOptionIndex;
    if (isCorrect) correctCount++;
    else wrongCount++;

    return { question, answer, isCorrect };
  };

  // Pre-calculate to populate correctCount / wrongCount
  const reviewData = exam.questions.map(q => getQuestionReview(q._id));
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // Group violations
  const violationCounts = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  const mapViolationName = (type) => {
    if (type === 'TAB_SWITCH' || type === 'tab-switch') return 'Tab switched';
    if (type === 'FULLSCREEN_EXIT' || type === 'fullscreen-exit') return 'Fullscreen exited';
    if (type === 'MINIMIZE' || type === 'window-blur') return 'Screen minimized';
    return type;
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <button onClick={() => navigate('/student')} className="btn-secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1rem' }}>
        <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Exam Review</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>{exam.title}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BarChart2 size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{percentage}%</div>
          <div style={{ color: 'var(--text-secondary)' }}>Total Score</div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <CheckCircle size={32} color="var(--success)" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--success)' }}>{correctCount}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Correct Answers ✅</div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <XCircle size={32} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--danger)' }}>{wrongCount}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Wrong Answers ❌</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertTriangle size={24} color="var(--warning)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Violation Summary 🚨</h2>
        </div>
        
        <div style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
          Total Violations: <strong style={{ color: 'var(--warning)' }}>{violations.length}</strong>
        </div>

        {violations.length > 0 ? (
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(violationCounts).map(([type, count]) => (
              <li key={type} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-primary)' }}>{mapViolationName(type)}</span>
                <span style={{ fontWeight: '600', color: 'var(--warning)' }}>{count} time{count > 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: 'var(--success)' }}>Perfect integrity! No violations detected.</div>
        )}
      </div>

      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '2rem' }}>Detailed Review</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {reviewData.map((data, idx) => {
          if (!data) return null;
          const { question, answer, isCorrect } = data;
          
          return (
            <div key={question._id} className="glass-panel" style={{ padding: '2rem', border: isCorrect ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <span style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', 
                  background: isCorrect ? 'var(--success)' : 'var(--danger)', color: 'white', borderRadius: '50%', fontWeight: '600', flexShrink: 0 
                }}>
                  {idx + 1}
                </span>
                <h3 style={{ fontSize: '1.15rem', lineHeight: '1.5', margin: 0, paddingTop: '3px' }}>
                  {question.questionText}
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '3rem' }}>
                {question.options.map((opt, optIndex) => {
                  const isSelected = answer && answer.selectedOptionIndex === optIndex;
                  const isActuallyCorrect = question.correctOptionIndex === optIndex;
                  
                  let bgColor = 'rgba(255,255,255,0.02)';
                  let borderColor = 'var(--surface-border)';
                  
                  if (isActuallyCorrect) {
                    bgColor = 'rgba(16, 185, 129, 0.15)';
                    borderColor = 'rgba(16, 185, 129, 0.5)';
                  } else if (isSelected && !isActuallyCorrect) {
                    bgColor = 'rgba(239, 68, 68, 0.15)';
                    borderColor = 'rgba(239, 68, 68, 0.5)';
                  }
                  
                  return (
                    <div 
                      key={optIndex} 
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        border: `1px solid ${borderColor}`,
                        background: bgColor,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>{opt}</span>
                      {isActuallyCorrect && <CheckCircle size={20} color="var(--success)" />}
                      {isSelected && !isActuallyCorrect && <XCircle size={20} color="var(--danger)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewExam;
