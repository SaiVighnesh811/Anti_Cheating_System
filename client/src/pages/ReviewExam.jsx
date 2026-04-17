import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, BarChart2, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const ReviewExam = () => {
  const { id: attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Theme state
  const [isDarkMode] = useState(() => {
    const saved = localStorage.getItem('student-theme');
    return saved === 'dark';
  });

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

  // Defined early so it can be used in the disqualification guard below
  const mapViolationName = (type) => {
    if (type === 'TAB_SWITCH' || type === 'tab-switch') return 'Tab switched';
    if (type === 'FULLSCREEN_EXIT' || type === 'fullscreen-exit') return 'Fullscreen exited';
    if (type === 'MINIMIZE' || type === 'window-blur') return 'Screen minimized';
    return type;
  };

  // ── Guard: block review page for disqualified students ──
  if (attempt.is_disqualified) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚫</div>
          <h1 style={{ fontSize: '2rem', color: 'var(--danger)', marginBottom: '1rem' }}>Disqualified</h1>
          <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
            You have been disqualified from this exam due to policy violations.<br />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Score and performance data are not available for disqualified attempts.</span>
          </p>
          {violations.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '0.5rem' }}>⚠️ Recorded Violations ({violations.length})</div>
              {violations.map((v, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {mapViolationName(v.type)} — {new Date(v.timestamp).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/student')} className="btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
            <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  const exam = attempt.exam;

  const totalQuestions = exam.questions.length;
  let correctCount = 0;
  let wrongCount = 0;

  const getQuestionReview = (questionId) => {
    const question = exam.questions.find(q => q._id === questionId);
    const answer = attempt.answers.find(a => a.questionId === questionId);
    if (!question) return null;

    let isCorrect = false;
    if (question.type === 'fill-in-blank') {
       isCorrect = (answer?.fillText || '').trim().toLowerCase() === (question.correctAnswerText || '').trim().toLowerCase() && (question.correctAnswerText || '').trim() !== '';
    } else {
       isCorrect = answer && answer.selectedOptionIndex === question.correctOptionIndex && typeof answer.selectedOptionIndex === 'number';
    }
    if (isCorrect) correctCount++;
    else wrongCount++;

    return { question, answer, isCorrect };
  };

  const reviewData = exam.questions.map(q => getQuestionReview(q._id));
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const violationCounts = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});


  // ── PDF Report Generation ──
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Exam Integrity Report', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Smart Exam Integrity System', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    // Student & Exam Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Student & Exam Details', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Student ID:  ${attempt.student}`, 14, y); y += 6;
    doc.text(`Exam:  ${exam.title}`, 14, y); y += 6;
    doc.text(`Attempt ID:  ${attemptId}`, 14, y); y += 6;
    doc.text(`Completed:  ${attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : 'N/A'}`, 14, y); y += 12;

    // Performance Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Exam Performance', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Questions:  ${totalQuestions}`, 14, y); y += 6;
    doc.setTextColor(16, 185, 129);
    doc.text(`Correct Answers:  ${correctCount}`, 14, y); y += 6;
    doc.setTextColor(239, 68, 68);
    doc.text(`Wrong Answers:  ${wrongCount}`, 14, y); y += 6;
    doc.setTextColor(99, 102, 241);
    doc.text(`Score:  ${percentage}%`, 14, y); y += 12;

    // Violation Summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Violation Summary', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Violations:  ${violations.length}`, 14, y); y += 6;
    if (Object.keys(violationCounts).length > 0) {
      Object.entries(violationCounts).forEach(([type, count]) => {
        doc.text(`  - ${mapViolationName(type)}: ${count}`, 14, y); y += 6;
      });
    } else {
      doc.setTextColor(16, 185, 129);
      doc.text('  No violations detected.', 14, y); y += 6;
    }
    y += 6;

    // Violation Timeline
    if (violations.length > 0) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Violation Timeline', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      violations.forEach((v, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const ts = new Date(v.timestamp).toLocaleString();
        doc.text(`${idx + 1}. ${mapViolationName(v.type)} at ${ts}`, 18, y);
        y += 5;
      });
    }

    // Footer line
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setDrawColor(99, 102, 241);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('This report was auto-generated by the Smart Exam Integrity System.', pageWidth / 2, y, { align: 'center' });

    doc.save(`Exam_Report_${attemptId}.pdf`);
  };

  return (
    <div className="student-theme-provider" style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dashboard)',
      color: 'var(--text-primary)',
      transition: 'all 0.3s ease',
      fontFamily: "'Inter', sans-serif"
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
      `}</style>
      <div className="page-container" style={{ maxWidth: '1000px', padding: '2rem', animation: 'fadeIn 0.6s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <button onClick={() => navigate('/student')} className="btn-secondary" style={{ padding: '0.75rem 1.25rem', fontWeight: '600' }}>
          <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Candidate Dashboard
        </button>
        <button onClick={generatePDF} className="btn-primary" style={{ padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: '700' }}>
          <Download size={20} /> Download Session Report
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <div style={{ display: 'inline-block', background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem 1.25rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
           Session Review
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.04em' }}>Performance Feedback</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', marginTop: '0.75rem', fontWeight: '500' }}>{exam.title}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ background: 'var(--primary-light)', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
             <BarChart2 size={32} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{percentage}<span style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>%</span></div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginTop: '0.5rem' }}>Proficiency Score</div>
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', border: `1px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}` }}>
          <div style={{ background: '#f0fdf4', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
             <CheckCircle size={32} color="#16a34a" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#16a34a' }}>{correctCount}</div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginTop: '0.5rem' }}>Accurate Sessions</div>
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', border: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'}` }}>
          <div style={{ background: '#fef2f2', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
             <XCircle size={32} color="#dc2626" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#dc2626' }}>{wrongCount}</div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', marginTop: '0.5rem' }}>Incorrect Inputs</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '4rem', border: `1.5px solid ${isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--warning-light)', padding: '0.6rem', borderRadius: '12px' }}>
            <AlertTriangle size={24} color="var(--warning)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Integrity Profile</h2>
        </div>
        
        <div style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
          Total Monitored Incidents: <strong style={{ color: violations.length > 0 ? 'var(--warning)' : 'var(--success)', fontSize: '1.3rem' }}>{violations.length}</strong>
        </div>

        {violations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(violationCounts).map(([type, count]) => (
              <div key={type} style={{ background: isDarkMode ? 'rgba(255, 252, 232, 0.05)' : '#fefce8', padding: '1rem 1.5rem', borderRadius: '14px', border: `1px solid ${isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: isDarkMode ? '#fef08a' : 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' }}>{mapViolationName(type)}</span>
                <span style={{ fontWeight: '800', color: isDarkMode ? '#fef08a' : 'var(--warning)', background: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff', padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>{count} Detected</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '1.25rem', borderRadius: '14px', fontWeight: '700', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={24} /> Optimal integrity maintained throughout the session.
          </div>
        )}
      </div>

      <div style={{ borderBottom: '2px solid var(--primary-light)', paddingBottom: '1rem', marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Detailed Assessment Review</h2>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {reviewData.map((data, idx) => {
          if (!data) return null;
          const { question, answer, isCorrect } = data;
          
          return (
            <div key={question._id} className="glass-panel" style={{ padding: '2.5rem', border: isCorrect ? `1.5px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(22, 163, 74, 0.1)'}` : `1.5px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(220, 38, 38, 0.1)'}` }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <span style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', 
                  background: isCorrect ? '#16a34a' : '#ef4444', color: 'white', borderRadius: '12px', fontWeight: '800', fontSize: '1.1rem', flexShrink: 0 
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                   {question.questionText && (
                     <h3 style={{ fontSize: '1.3rem', lineHeight: '1.5', margin: 0, paddingTop: '4px', fontWeight: '600', color: 'var(--text-primary)' }}>
                       {question.questionText}
                     </h3>
                   )}
                   {question.questionImage && (
                     <img src={question.questionImage} alt="Problem statement" style={{ marginTop: '1rem', maxWidth: '100%', borderRadius: '12px', border: '1.5px solid var(--surface-border)' }} />
                   )}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '4.5rem' }}>
                {question.type === 'fill-in-blank' ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ padding: '1.1rem 1.5rem', borderRadius: '14px', border: `1.5px solid ${isCorrect ? (isDarkMode ? 'rgba(22, 163, 74, 0.4)' : '#bbf7d0') : (isDarkMode ? 'rgba(239, 68, 68, 0.4)' : '#fecaca')}`, background: isCorrect ? (isDarkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4') : (isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Your Answer</div>
                            <span style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)' }}>{answer?.fillText || '(None)'}</span>
                         </div>
                         {isCorrect ? <CheckCircle size={24} color={isDarkMode ? '#4ade80' : '#16a34a'} /> : <XCircle size={24} color={isDarkMode ? '#f87171' : '#dc2626'} />}
                      </div>
                      {!isCorrect && (
                         <div style={{ padding: '1.1rem 1.5rem', borderRadius: '14px', border: `1.5px solid ${isDarkMode ? 'rgba(22, 163, 74, 0.4)' : '#bbf7d0'}`, background: isDarkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                               <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Correct Answer</div>
                               <span style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)' }}>{question.correctAnswerText || ''}</span>
                            </div>
                            <CheckCircle size={24} color={isDarkMode ? '#4ade80' : '#16a34a'} />
                         </div>
                      )}
                   </div>
                ) : (
                  question.options.map((opt, optIndex) => {
                    const isSelected = answer && answer.selectedOptionIndex === optIndex;
                    const isActuallyCorrect = question.correctOptionIndex === optIndex;
                    const optImg = question.optionImages?.[optIndex];
                    
                    let bgColor = isDarkMode ? 'rgba(255,255,255,0.02)' : '#fbfcfd';
                    let borderColor = 'var(--surface-border)';
                    let icon = null;
                    
                    if (isActuallyCorrect) {
                      bgColor = isDarkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4';
                      borderColor = isDarkMode ? 'rgba(22, 163, 74, 0.4)' : '#bbf7d0';
                      icon = <CheckCircle size={20} color={isDarkMode ? '#4ade80' : '#16a34a'} />;
                    } else if (isSelected && !isActuallyCorrect) {
                      bgColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2';
                      borderColor = isDarkMode ? 'rgba(239, 68, 68, 0.4)' : '#fecaca';
                      icon = <XCircle size={20} color={isDarkMode ? '#f87171' : '#dc2626'} />;
                    }
                    
                    return (
                      <div 
                        key={optIndex} 
                        style={{ 
                          padding: '1.1rem 1.5rem', 
                          borderRadius: '14px', 
                          border: `1.5px solid ${borderColor}`,
                          background: bgColor,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {opt && <span style={{ fontSize: '1.05rem', fontWeight: (isSelected || isActuallyCorrect) ? '600' : '400', color: 'var(--text-primary)' }}>{opt}</span>}
                          {optImg && <img src={optImg} alt={`Option ${optIndex + 1}`} style={{ maxWidth: '250px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />}
                        </div>
                        {icon}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
};

export default ReviewExam;
