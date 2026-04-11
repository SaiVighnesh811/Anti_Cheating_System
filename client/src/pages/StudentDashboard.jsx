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
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Student Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {user?.name}</p>
        </div>
        <button className="btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <BookOpen size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Available Exams</h2>
          </div>
          
          {exams.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No exams available right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {exams.map(exam => {
                const alreadyTaken = myAttempts.some(a => a.exam._id === exam._id && (a.status === 'completed' || a.is_disqualified));
                const inProgress = myAttempts.find(a => a.exam._id === exam._id && a.status === 'in-progress' && !a.is_disqualified);

                if (alreadyTaken) return null; // Hide already taken / disqualified exams

                return (
                  <div key={exam._id} style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>{exam.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>{exam.description || 'No description provided.'}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <Clock size={16} /> {exam.durationMinutes} Minutes
                      </div>
                      
                      {inProgress ? (
                        <button onClick={() => navigate(`/student/exam/${inProgress._id}`)} className="btn-primary" style={{ background: 'var(--warning)', color: '#000' }}>
                          Resume Exam
                        </button>
                      ) : (
                        <button onClick={() => handleStartExam(exam._id)} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
                          <PlayCircle size={18} /> Start Exam
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Award size={24} color="var(--success)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>My Results</h2>
          </div>
          
          {myAttempts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>You haven't completed any exams yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myAttempts.filter(a => a.status === 'completed' || a.is_disqualified).map(attempt => {
                if (attempt.is_disqualified) {
                  return (
                    <div key={attempt._id} style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{attempt.exam?.title}</h3>
                        <span style={{ background: 'rgba(239,68,68,0.18)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.4)', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700' }}>🚫 DISQUALIFIED</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--danger)', margin: '0.4rem 0 0', lineHeight: '1.5' }}>
                        You have been disqualified from this exam due to policy violations. Score is not available.
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={attempt._id} style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontWeight: '500' }}>{attempt.exam?.title}</h3>
                      <span style={{ fontWeight: '700', color: 'var(--success)' }}>Score: {attempt.score}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Completed: {new Date(attempt.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
