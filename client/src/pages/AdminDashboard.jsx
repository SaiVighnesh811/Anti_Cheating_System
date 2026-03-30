import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, FileText, AlertTriangle, LogOut, Filter } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState([]);
  const [rawViolations, setRawViolations] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentGroup, setSelectedStudentGroup] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [examsRes, violationsRes, attemptsRes] = await Promise.all([
          api.get('/exams'),
          api.get('/attempts/violations/all'),
          api.get('/attempts/all')
        ]);
        setExams(examsRes.data);
        setRawViolations(violationsRes.data);
        setAttempts(attemptsRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Filter violations by selected exam
  const filteredViolations = useMemo(() => {
    if (selectedExamId === 'all') return rawViolations;
    return rawViolations.filter(v => v.exam?._id === selectedExamId || v.exam === selectedExamId);
  }, [rawViolations, selectedExamId]);

  // Group filtered violations by student
  const violations = useMemo(() => {
    const grouped = filteredViolations.reduce((acc, v) => {
      const sId = v.student?._id;
      if (!sId) return acc;
      if (!acc[sId]) {
        acc[sId] = { student: v.student, total: 0, tab: 0, fullscreen: 0, minimize: 0, history: [] };
      }
      acc[sId].total += 1;
      acc[sId].history.push(v);
      if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') acc[sId].tab += 1;
      if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') acc[sId].fullscreen += 1;
      if (v.type === 'MINIMIZE' || v.type === 'window-blur') acc[sId].minimize += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredViolations]);

  // Chart data
  const barChartData = useMemo(() => {
    const top10 = violations.slice(0, 10);
    return {
      labels: top10.map(g => g.student.name),
      datasets: [{
        label: 'Violations',
        data: top10.map(g => g.total),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
        borderRadius: 6
      }]
    };
  }, [violations]);

  const pieChartData = useMemo(() => {
    let tabCount = 0, fsCount = 0;
    filteredViolations.forEach(v => {
      if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') tabCount++;
      else if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') fsCount++;
    });
    return {
      labels: ['Tab Switch', 'Fullscreen Exit'],
      datasets: [{
        data: [tabCount, fsCount],
        backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)'],
        borderColor: ['rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)'],
        borderWidth: 1
      }]
    };
  }, [filteredViolations]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } } }
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.6)', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 13 }, padding: 20 } }
    }
  };

  if (loading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Dashboard...</div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Admin Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {user?.name}</p>
        </div>
        <button className="btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Analytics Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Violations Per Student
          </h2>
          <div style={{ height: '280px' }}>
            {violations.length > 0 ? (
              <Bar data={barChartData} options={chartOptions} />
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '4rem' }}>No violation data to display.</p>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🧩 Violation Type Distribution
          </h2>
          <div style={{ height: '280px', display: 'flex', justifyContent: 'center' }}>
            {filteredViolations.length > 0 ? (
              <Pie data={pieChartData} options={pieOptions} />
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '4rem' }}>No violation data to display.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Suspicious Students Leaderboard */}
      {violations.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚨 Top Suspicious Students
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {violations.slice(0, 5).map((group, idx) => (
              <div key={group.student._id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid ${idx === 0 ? 'var(--danger)' : 'var(--warning)'}` }}>
                <span style={{ fontWeight: '700', fontSize: '1.2rem', color: idx === 0 ? 'var(--danger)' : 'var(--warning)', width: '2rem', textAlign: 'center' }}>#{idx + 1}</span>
                <span style={{ flex: 1, fontWeight: '500' }}>{group.student.name}</span>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: '600', fontSize: '0.85rem' }}>
                  {group.total} violations
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Active Exams</h2>
            <Link to="/admin/create-exam" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <PlusCircle size={16} /> New Exam
            </Link>
          </div>
          
          {exams.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No active exams currently available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {exams.map(exam => (
                <div key={exam._id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FileText size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '500' }}>{exam.title}</h3>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                    <span>Duration: {exam.durationMinutes}m</span>
                    <span>Questions: {exam.questions.length}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} color="var(--warning)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Violations</h2>
            </div>
            {/* Exam Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--text-secondary)" />
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ background: '#1a1a2e' }}>All Exams</option>
                {exams.map(e => (
                  <option key={e._id} value={e._id} style={{ background: '#1a1a2e' }}>{e.title}</option>
                ))}
              </select>
            </div>
          </div>
          
          {violations.length === 0 ? (
            <p style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></div>
              No cheating violations recorded{selectedExamId !== 'all' ? ' for this exam' : ''}. All clear!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {violations.map(group => (
                <div 
                  key={group.student._id} 
                  className="glass-panel" 
                  onClick={() => setSelectedStudentGroup(group)}
                  style={{ 
                    padding: '1.25rem', 
                    border: '1px solid rgba(245, 158, 11, 0.3)', 
                    transition: 'transform 0.2s', 
                    cursor: 'pointer' 
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{group.student.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click for details</span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {group.total} Total
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>🚫</div>
                      <div style={{ fontWeight: '700', color: group.tab > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{group.tab}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>⚠️</div>
                      <div style={{ fontWeight: '700', color: group.fullscreen > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{group.fullscreen}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FileText size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Student Results</h2>
        </div>
        
        {attempts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No student attempts recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Student</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Exam</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '1rem', fontWeight: '500' }}>Date</th>
                  <th style={{ padding: '1rem', fontWeight: '500', textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(attempt => (
                  <tr key={attempt._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '500' }}>{attempt.student?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{attempt.student?.email || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>{attempt.exam?.title || 'Deleted Exam'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '999px', 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        background: attempt.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: attempt.status === 'completed' ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {attempt.status ? attempt.status.toUpperCase() : 'UNKNOWN'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(attempt.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      {attempt.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Student Violation Modal */}
      {selectedStudentGroup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '700px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            animation: 'popupScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{selectedStudentGroup.student.name}</h2>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedStudentGroup.student.email}{selectedExamId !== 'all' ? ` • Filtered by exam` : ''}</div>
              </div>
              <button 
                onClick={() => setSelectedStudentGroup(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '2rem', cursor: 'pointer', padding: '0 0.5rem' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--danger)' }}>{selectedStudentGroup.total}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Total 🚨</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{selectedStudentGroup.tab}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tab Switches 🚫</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{selectedStudentGroup.fullscreen}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fullscreen ⚠️</div>
                </div>
              </div>

              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="var(--warning)" /> Violation History
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedStudentGroup.history.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No history details available.</p>
                ) : (
                  selectedStudentGroup.history.map((log, idx) => {
                    let descriptor = '';
                    if (log.type === 'TAB_SWITCH' || log.type === 'tab-switch') descriptor = 'Tab switched';
                    else if (log.type === 'FULLSCREEN_EXIT' || log.type === 'fullscreen-exit') descriptor = 'Fullscreen exited';
                    else if (log.type === 'MINIMIZE' || log.type === 'window-blur') descriptor = 'Screen minimized';
                    else descriptor = `Triggered ${log.type}`;

                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--warning)', borderRadius: '4px' }}>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{descriptor}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(log.timestamp).toLocaleString()}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
