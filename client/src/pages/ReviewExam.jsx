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

    const isCorrect = answer && answer.selectedOptionIndex === question.correctOptionIndex;
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
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate('/student')} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
          <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Back to Dashboard
        </button>
        <button onClick={generatePDF} className="btn-primary" style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} /> Download PDF Report
        </button>
      </div>

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
