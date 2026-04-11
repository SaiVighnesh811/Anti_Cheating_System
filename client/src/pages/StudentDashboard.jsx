import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlayCircle, Award, LogOut, Clock, BookOpen } from 'lucide-react';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('student-theme');
    return saved === 'dark';
  });

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      localStorage.setItem('student-theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const [examsRes, attemptsRes] = await Promise.all([
          api.get('/exams'),
          api.get('/attempts/my-attempts')
        ]);
        setExams(examsRes.data);
        setMyAttempts(attemptsRes.data);
      } catch (err) {
        console.error('Error fetching student data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentData();
  }, []);

  const handleStartExam = async (examId) => {
    if (window.confirm("Are you sure you want to start this exam now? The timer will begin immediately.")) {
      try {
        const { data } = await api.post('/attempts/start', { examId });
        navigate(`/student/exam/${data._id}`);
      } catch (err) {
        alert(err.response?.data?.message || 'Error starting exam');
      }
    }
  };

  if (loading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Dashboard...</div>;

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
          --surface-panel: ${isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#ffffff'};
          --surface-card: ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
          --card-hover: ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9'};
          --text-primary: ${isDarkMode ? '#f1f5f9' : '#1e293b'};
          --text-secondary: ${isDarkMode ? '#94a3b8' : '#64748b'};
          --surface-border: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'};
          --card-shadow: ${isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.04)'};
        }

        .glass-panel {
          background: var(--surface-panel) !important;
          border: 1px solid var(--surface-border) !important;
          box-shadow: var(--card-shadow) !important;
        }
      `}</style>
      <div className="page-container" style={{ animation: 'fadeIn 0.6s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>Candidate Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>Welcome back, <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{user?.name}</span></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={toggleTheme} 
            className="btn-secondary" 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.6rem 1rem', borderRadius: '12px',
              background: 'var(--surface-panel)', border: '1px solid var(--surface-border)',
              boxShadow: 'var(--card-shadow)', color: 'var(--text-primary)'
            }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.5rem', fontWeight: '600' }}>
            <LogOut size={18} /> Logout Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem' }}>

        {/* Available Exams Section */}
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '14px' }}>
              <BookOpen size={28} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Open Assessments</h2>
          </div>

          {exams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <p style={{ fontWeight: '500' }}>No examination sessions scheduled at this time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {exams.map(exam => {
                  const alreadyTaken = myAttempts.some(a => a.exam._id === exam._id && (a.status === 'completed' || a.is_disqualified));
                  const inProgress = myAttempts.find(a => a.exam._id === exam._id && a.status === 'in-progress' && !a.is_disqualified);

                  if (alreadyTaken) return null;

                  const now = new Date();
                  const start = exam.startTime ? new Date(exam.startTime) : null;
                  const end = exam.endTime ? new Date(exam.endTime) : null;
                  
                  let status = 'Live';
                  let canStart = true;
                  let statusColor = 'var(--success)';

                  if (start && now < start) {
                    status = 'Upcoming';
                    canStart = false;
                    statusColor = 'var(--warning)';
                  } else if (end && now > end) {
                    status = 'Expired';
                    canStart = false;
                    statusColor = 'var(--danger)';
                  }

                  return (
                    <div key={exam._id} className="exam-card-hover" style={{
                      background: 'var(--surface-card)', padding: '1.75rem', borderRadius: '18px',
                      border: '1.5px solid var(--surface-border)', transition: 'all 0.3s ease',
                      opacity: canStart || inProgress ? 1 : 0.7
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{exam.title}</h3>
                        <div style={{ background: `${statusColor}15`, color: statusColor, padding: '0.3rem 0.7rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {status}
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>{exam.description || 'Proctored examination session.'}</p>

                      <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={14} color="var(--primary)" /> <strong>Duration:</strong> {exam.durationMinutes}m
                        </div>
                        {start && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 14, textAlign: 'center' }}>🗓️</div> <strong>Starts:</strong> {start.toLocaleString()}
                          </div>
                        )}
                        {end && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 14, textAlign: 'center' }}>⏳</div> <strong>Ends:</strong> {end.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {inProgress ? (
                          <button onClick={() => navigate(`/student/exam/${inProgress._id}`)} className="btn-primary" style={{ background: 'var(--warning)', color: '#000', padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}>
                            Resume Secure Session
                          </button>
                        ) : (
                          <button 
                            disabled={!canStart}
                            onClick={() => canStart && handleStartExam(exam._id)} 
                            className="btn-primary" 
                            style={{ 
                              padding: '0.6rem 1.5rem', 
                              fontSize: '0.9rem',
                              opacity: canStart ? 1 : 0.5,
                              cursor: canStart ? 'pointer' : 'not-allowed',
                              background: !canStart ? '#94a3b8' : 'var(--primary)'
                            }}
                          >
                            <PlayCircle size={18} /> {canStart ? 'Begin Exam' : status === 'Upcoming' ? 'Not Started' : 'Assessment Closed'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '14px' }}>
              <Award size={28} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>History & Performance</h2>
          </div>

          {myAttempts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <p style={{ fontWeight: '500' }}>Your completed session history will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).map(attempt => {
                if (attempt.is_disqualified) {
                  return (
                    <div key={attempt._id} style={{
                      background: 'var(--danger-light)', padding: '1.5rem', borderRadius: '18px',
                      border: '1.5px solid rgba(220,38,38,0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1.15rem' }}>{attempt.exam?.title}</h3>
                        <span style={{ background: 'var(--danger)', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.05em' }}>TERMINATED</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--danger)', margin: 0, fontWeight: '500', lineHeight: '1.5' }}>
                        Session disqualified due to multiple integrity violations.
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={attempt._id} style={{
                    background: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4', padding: '1.5rem', borderRadius: '18px',
                    border: `1.5px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1.15rem' }}>{attempt.exam?.title}</h3>
                      <div style={{ background: 'var(--success)', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '800' }}>
                        Score: {attempt.score}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={14} /> Submitted: {new Date(attempt.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
