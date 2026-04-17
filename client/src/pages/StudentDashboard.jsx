import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlayCircle, Award, LogOut, Clock, BookOpen, Calendar, CheckCircle, AlertCircle, TrendingUp, Target, Activity, Timer } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
);

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

  // Countdown timer logic
  const [nextExam, setNextExam] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (exams.length > 0) {
      const upcoming = exams
        .filter(e => e.startTime && new Date(e.startTime) > new Date())
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      if (upcoming.length > 0) {
        setNextExam(upcoming[0]);
      } else {
        setNextExam(null);
      }
    }
  }, [exams]);

  useEffect(() => {
    if (!nextExam) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(nextExam.startTime).getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft('Started');
        // Optionally refetch data if exam starts
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextExam]);

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

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {[
            {
              title: 'Upcoming Exams',
              value: exams.filter(e => e.startTime && new Date(e.startTime) > new Date()).length,
              icon: <Calendar size={24} />,
              color: '#3b82f6',
              bg: 'rgba(59, 130, 246, 0.1)'
            },
            {
              title: 'Completed Exams',
              value: myAttempts.filter(a => a.status === 'completed' && !a.is_disqualified).length,
              icon: <CheckCircle size={24} />,
              color: '#10b981',
              bg: 'rgba(16, 185, 129, 0.1)'
            },
            {
              title: 'Disqualified Exams',
              value: myAttempts.filter(a => a.is_disqualified).length,
              icon: <AlertCircle size={24} />,
              color: '#ef4444',
              bg: 'rgba(239, 68, 68, 0.1)'
            },
            {
              title: 'Average Score',
              value: (function () {
                const completed = myAttempts.filter(a => a.status === 'completed' && !a.is_disqualified);
                if (completed.length === 0) return '0%';
                const totalScore = completed.reduce((acc, curr) => acc + curr.score, 0);
                // Fallback to average numerical score if we can't get total questions
                // For now, let's assume if there are exams in 'exams' that match, we use their question count
                const avg = totalScore / completed.length;
                return avg.toFixed(1);
              })(),
              icon: <Award size={24} />,
              color: '#8b5cf6',
              bg: 'rgba(139, 92, 246, 0.1)'
            }
          ].map((card, idx) => (
            <div key={idx} className="glass-panel" style={{
              padding: '1.5rem',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              transition: 'transform 0.3s ease'
            }}>
              <div style={{
                background: card.bg,
                color: card.color,
                padding: '0.8rem',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {card.icon}
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{card.value}</h3>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem' }}>

          {/* Next Exam Countdown */}
          {nextExam && (
            <div className="glass-panel" style={{
              gridColumn: '1 / -1',
              padding: '2rem',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  <Timer size={20} />
                  <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Next Scheduled Assessment</span>
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>{nextExam.title}</h2>
                <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '1rem' }}>Starts at {new Date(nextExam.startTime).toLocaleString()}</p>
              </div>
              <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', opacity: 0.9, marginBottom: '0.25rem' }}>COMMENCING IN</div>
                <div style={{ fontSize: '3.5rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '2px', lineHeight: 1 }}>
                  {timeLeft}
                </div>
              </div>
              {/* Decorative background element */}
              <div style={{
                position: 'absolute',
                right: '-50px',
                top: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%',
                zIndex: 0
              }}></div>
            </div>
          )}

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
                  // Compute exam end: use explicit endTime OR startTime + duration
                  const end = exam.endTime
                    ? new Date(exam.endTime)
                    : (start ? new Date(start.getTime() + exam.durationMinutes * 60000) : null);

                  let status = 'Active';
                  let canStart = true;
                  let statusColor = 'var(--success)';

                  if (start && now < start) {
                    status = 'Not Started';
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
                        <div style={{ background: `${statusColor}15`, color: statusColor, padding: '0.3rem 0.7rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {status === 'Expired' && <span>🔴</span>}
                          {status === 'Active' && <span>🟢</span>}
                          {status === 'Not Started' && <span>🟡</span>}
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
                          <button
                            disabled={!canStart}
                            onClick={() => canStart && navigate(`/student/exam/${inProgress._id}`)}
                            className="btn-primary"
                            style={{
                              background: !canStart ? '#94a3b8' : 'var(--warning)',
                              color: !canStart ? '#fff' : '#000',
                              padding: '0.6rem 1.25rem',
                              fontSize: '0.9rem',
                              opacity: canStart ? 1 : 0.5,
                              cursor: canStart ? 'pointer' : 'not-allowed'
                            }}>
                            {canStart ? 'Resume Secure Session' : 'Assessment Closed'}
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
                            <PlayCircle size={18} /> {canStart ? 'Begin Exam' : status === 'Not Started' ? 'Not Started' : 'Assessment Closed'}
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
          {/* Performance Analytics Section */}
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '2.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '14px' }}>
                <TrendingUp size={28} color="#8b5cf6" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Performance Analytics</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Visual tracking of your examination progress</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem' }}>
              {/* Score History Line Chart */}
              <div style={{ background: 'var(--surface-card)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <Activity size={18} color="#8b5cf6" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Score History</h3>
                </div>
                <div style={{ height: '250px' }}>
                  <Line
                    data={{
                      labels: myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).reverse().map(a => a.exam?.title || 'Exam'),
                      datasets: [{
                        label: 'Score',
                        data: myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).reverse().map(a => a.score),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#8b5cf6',
                        pointRadius: 4
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Accuracy Circular Metric */}
              <div style={{ background: 'var(--surface-card)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', width: '100%' }}>
                  <Target size={18} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Overall Accuracy</h3>
                </div>
                <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="12" />
                    <circle cx="80" cy="80" r="70" fill="none" stroke="#10b981" strokeWidth="12" strokeDasharray={440}
                      strokeDashoffset={440 - (440 * (function () {
                        const completed = myAttempts.filter(a => a.status === 'completed' && !a.is_disqualified);
                        if (completed.length === 0) return 0;
                        // Try to find each attempt's exam in the exams list to get question count
                        const totalAcc = completed.reduce((acc, curr) => {
                          const examData = exams.find(e => e._id === curr.exam?._id);
                          const max = (examData && examData.questions) ? examData.questions.length : (curr.score > 10 ? curr.score : 10);
                          return acc + (curr.score / max);
                        }, 0);
                        return (totalAcc / completed.length);
                      })())}
                      strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {Math.round((function () {
                        const completed = myAttempts.filter(a => a.status === 'completed' && !a.is_disqualified);
                        if (completed.length === 0) return 0;
                        const totalAcc = completed.reduce((acc, curr) => {
                          const examData = exams.find(e => e._id === curr.exam?._id);
                          const max = (examData && examData.questions) ? examData.questions.length : (curr.score > 10 ? curr.score : 10);
                          return acc + (curr.score / max);
                        }, 0);
                        return (totalAcc / completed.length) * 100;
                      })())}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>ACCURACY</span>
                  </div>
                </div>
              </div>

              {/* Time Taken Bar Chart/List */}
              <div style={{ background: 'var(--surface-card)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <Timer size={18} color="#3b82f6" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Attempt Duration</h3>
                </div>
                <div style={{ height: '250px' }}>
                  <Bar
                    data={{
                      labels: myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).slice(0, 5).map(a => a.exam?.title?.substring(0, 10) + '...'),
                      datasets: [{
                        label: 'Minutes',
                        data: myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).slice(0, 5).map(a => {
                          const start = new Date(a.startedAt);
                          const end = new Date(a.completedAt || new Date());
                          return Math.round((end - start) / (1000 * 60));
                        }),
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderRadius: 8
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Mins', font: { size: 10 } } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
