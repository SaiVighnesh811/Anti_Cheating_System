import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, FileText, AlertTriangle, LogOut } from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState([]);
  const [violations, setViolations] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [examsRes, violationsRes, attemptsRes] = await Promise.all([
          api.get('/exams'),
          api.get('/attempts/violations/all'),
          api.get('/attempts/all')
        ]);
        setExams(examsRes.data);
        
        // Group violations by student
        const rawViolations = violationsRes.data;
        const studentViolations = rawViolations.reduce((acc, v) => {
          const sId = v.student?._id;
          if (!sId) return acc;
          if (!acc[sId]) {
            acc[sId] = { student: v.student, total: 0, tab: 0, fullscreen: 0, minimize: 0 };
          }
          acc[sId].total += 1;
          if (v.type === 'TAB_SWITCH' || v.type === 'tab-switch') acc[sId].tab += 1;
          if (v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit') acc[sId].fullscreen += 1;
          if (v.type === 'MINIMIZE' || v.type === 'window-blur') acc[sId].minimize += 1;
          return acc;
        }, {});
        
        setViolations(Object.values(studentViolations).sort((a,b) => b.total - a.total));
        setAttempts(attemptsRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <AlertTriangle size={24} color="var(--warning)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Recent Violations</h2>
          </div>
          
          {violations.length === 0 ? (
            <p style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></div>
              No cheating violations recorded yet. All clear!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {violations.map(group => (
                <div key={group.student._id} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)', transition: 'transform 0.2s', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{group.student.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.student.email}</span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {group.total} Total
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>🚫</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Tab Switch</div>
                      <div style={{ fontWeight: '700', color: group.tab > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{group.tab}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>⚠️</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Fullscreen</div>
                      <div style={{ fontWeight: '700', color: group.fullscreen > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{group.fullscreen}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>📉</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Minimize</div>
                      <div style={{ fontWeight: '700', color: group.minimize > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{group.minimize}</div>
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
    </div>
  );
};

export default AdminDashboard;
