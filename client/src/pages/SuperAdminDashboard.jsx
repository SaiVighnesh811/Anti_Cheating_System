import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Users, FileText, Activity, Search, Sun, Moon, Shield, GraduationCap, User, Trash, History } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const LoginActivityTimeline = ({ history, isDarkMode }) => {
  return (
    <div className="timeline-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem', padding: '1rem',
        background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDarkMode ? 'rgba(13,148,136,0.18)' : 'rgba(13,148,136,0.1)'}`,
        borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Activity size={18} color="var(--primary)" />
          <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>Live Login Activity</span>
        </div>
      </div>
      <div style={{
        background: isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: '14px', padding: '1.5rem', overflowX: 'auto', flex: 1, minHeight: '300px'
      }}>
        {history.length === 0 ? (
           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No activity</div>
        ) : (
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                 <tr style={{ borderBottom: '2px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>User Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Email</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Login Time</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                 </tr>
              </thead>
              <tbody>
                 {history.map((log, idx) => {
                    const ts = new Date(log.createdAt);
                    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    // Provide mock active status (green internal logic)
                    const isActive = (new Date() - ts) < 2 * 60 * 60 * 1000;
                    
                    return (
                       <tr key={idx} className="table-row" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500', color: 'var(--text-primary)' }}>{log.name}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{log.email}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{log.role}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{timeStr}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              {isActive ? (
                                  <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: '600' }}>🟢 Active</span>
                              ) : (
                                  <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: '600' }}>⚪ Logged Out</span>
                              )}
                          </td>
                       </tr>
                    );
                 })}
              </tbody>
           </table>
        )}
      </div>
    </div>
  );
};

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const [usersInfo, setUsersInfo] = useState([]);
  const [activities, setActivities] = useState([]);
  const [exams, setExams] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  const fetchData = async () => {
    try {
      const [usersRes, actsRes, examsRes, auditRes] = await Promise.all([
        api.get('/superadmin/users'),
        api.get('/superadmin/login-activities'),
        api.get('/superadmin/exams'),
        api.get('/superadmin/audit-logs')
      ]);
      setUsersInfo(usersRes.data);
      setActivities(actsRes.data);
      setExams(examsRes.data);
      setAuditLogs(auditRes.data);
    } catch (err) {
      console.error('Failed to fetch superadmin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? All their data will be permanently removed.')) {
      try {
         await api.delete(`/superadmin/delete-user/${userId}`);
         alert('User deleted successfully ✅');
         fetchData();
      } catch (err) {
         alert('Failed to delete user ❌');
         console.error(err);
      }
    }
  };

  const getRoleBadge = (role) => {
    let bg = 'rgba(59, 130, 246, 0.15)';
    let color = '#3b82f6';
    let text = 'Student';
    let icon = '🧑‍💻';
    if (role === 'admin') {
      bg = 'rgba(16, 185, 129, 0.15)'; 
      color = '#10b981';
      text = 'Teacher';
      icon = '🎓';
    } else if (role === 'superadmin') {
      bg = 'rgba(13, 148, 136, 0.15)';
      color = '#0d9488';
      text = 'Super Admin';
      icon = '👑';
    }
    return (
      <span style={{ backgroundColor: bg, color: color, padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {icon} {text}
      </span>
    );
  };

  const filteredUsers = useMemo(() => {
    return usersInfo.filter(u => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [usersInfo, roleFilter, searchQuery]);

  const teacherCount = usersInfo.filter(u => u.role === 'admin').length;
  const studentCount = usersInfo.filter(u => u.role === 'student').length;

  const pieChartData = {
    labels: ['Teachers', 'Students'],
    datasets: [{
      data: [teacherCount, studentCount],
      backgroundColor: ['rgba(13, 148, 136, 0.8)', 'rgba(59, 130, 246, 0.8)'],
      borderColor: ['#0d9488', '#3b82f6'],
      borderWidth: 2
    }]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: isDarkMode ? '#f1f5f9' : '#1e293b', font: { weight: '600' } } },
      tooltip: { backgroundColor: isDarkMode ? '#1e293b' : 'rgba(255,255,255,0.9)', titleColor: isDarkMode ? '#f1f5f9' : '#0f172a', bodyColor: isDarkMode ? '#94a3b8' : '#475569' }
    }
  };

  return (
    <div className="dashboard-theme-provider">
      <div className="page-container" style={{ transition: 'all var(--transition-speed) ease' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          :root {
            --transition-speed: 0.3s;
          }
          .dashboard-theme-provider {
            --bg-dashboard: ${isDarkMode ? '#0f172a' : '#f8fafc'};
            --surface-panel: ${isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#ffffff'};
            --surface-card: ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
            --card-hover: ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#fdfdfd'};
            --text-primary: ${isDarkMode ? '#f1f5f9' : '#111827'};
            --text-secondary: ${isDarkMode ? '#94a3b8' : '#4b5563'};
            --surface-border: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'};
            --card-shadow: ${isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.04)'};
            --primary: #0d9488;
            --primary-light: ${isDarkMode ? 'rgba(13, 148, 136, 0.15)' : 'rgba(13, 148, 136, 0.06)'};
            min-height: 100vh;
            background-color: var(--bg-dashboard);
            color: var(--text-primary);
            transition: background-color var(--transition-speed), color var(--transition-speed);
            font-family: 'Inter', sans-serif;
          }
          .glass-panel {
            background: var(--surface-panel) !important;
            border: 1px solid var(--surface-border) !important;
            box-shadow: var(--card-shadow) !important;
            transition: all var(--transition-speed) ease;
          }
          .hover-card {
             transition: all 0.3s ease;
          }
          .hover-card:hover {
             transform: translateY(-4px) scale(1.02);
             box-shadow: ${isDarkMode ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.08)'};
             background: var(--card-hover);
          }
          .table-row {
             transition: background 0.2s ease;
          }
          .table-row:hover {
             background: ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'};
          }
          .timeline-list { list-style: none; padding: 0; margin: 0; position: relative; }
          .timeline-list::before { content: ''; position: absolute; left: 63px; top: 10px; bottom: 10px; width: 2px; background: linear-gradient(180deg, rgba(13,148,136,0.5) 0%, rgba(13,148,136,0) 100%); }
          .timeline-item { display: flex; align-items: flex-start; margin-bottom: 1rem; opacity: 0; animation: fadeUp 0.5s forwards; }
          @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } from { opacity: 0; transform: translateY(10px); } }
          
          /* Custom Scrollbar */
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', animation: 'fadeUp 0.5s ease-out' }}>
          <div>
             <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{background: 'var(--primary-light)', padding: '0.5rem', borderRadius: '12px'}}><Shield size={28} color="var(--primary)" /></span>
                Super Admin Portal
             </h1>
             <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Welcome back, <strong>{user?.name}</strong> <span style={{fontSize: '1rem'}}>👑</span>
             </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <button onClick={toggleTheme} className="btn-secondary" style={{ padding: '0.75rem', borderRadius: '12px', display: 'flex' }}>
                {isDarkMode ? <Sun size={20} color="#fcd34d" /> : <Moon size={20} color="#64748b" />}
             </button>
             <button onClick={logout} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontWeight: '600', borderRadius: '12px' }}>
                <LogOut size={16} /> Logout
             </button>
          </div>
        </div>

        {loading ? (
           <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
             {[1,2,3,4].map(i => <div key={i} className="glass-panel" style={{flex: 1, height: '120px', borderRadius: '16px', animation: 'pulse 1.5s infinite'}} />)}
           </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div className="glass-panel hover-card" style={{ padding: '1.75rem', borderRadius: '16px', animation: 'fadeUp 0.4s 0.1s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '0.75rem', borderRadius: '12px' }}><Users size={24} color="#3b82f6" /></div>
                   <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{usersInfo.length}</span>
                </div>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: '600' }}>Total Users</h3>
              </div>
              
              <div className="glass-panel hover-card" style={{ padding: '1.75rem', borderRadius: '16px', animation: 'fadeUp 0.4s 0.2s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: '12px' }}><GraduationCap size={24} color="#10b981" /></div>
                   <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{teacherCount}</span>
                </div>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: '600' }}>Total Teachers</h3>
              </div>

              <div className="glass-panel hover-card" style={{ padding: '1.75rem', borderRadius: '16px', animation: 'fadeUp 0.4s 0.3s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '0.75rem', borderRadius: '12px' }}><User size={24} color="#ef4444" /></div>
                   <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{studentCount}</span>
                </div>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: '600' }}>Total Students</h3>
              </div>

              <div className="glass-panel hover-card" style={{ padding: '1.75rem', borderRadius: '16px', animation: 'fadeUp 0.4s 0.4s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.75rem', borderRadius: '12px' }}><FileText size={24} color="#f59e0b" /></div>
                   <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{exams.length}</span>
                </div>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: '600' }}>Exams Created</h3>
              </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              
              {/* Left Column - User/Exam Tables */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 
                 {/* Users Table Panel */}
                 <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', animation: 'fadeUp 0.5s 0.3s both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                       <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users size={20} color="var(--primary)" /> User Directory
                       </h2>
                       <div style={{ display: 'flex', gap: '1rem' }}>
                          <div style={{ position: 'relative' }}>
                             <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                             <input 
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                   padding: '0.6rem 1rem 0.6rem 2.2rem',
                                   borderRadius: '8px',
                                   border: '1px solid var(--surface-border)',
                                   background: 'var(--surface-card)',
                                   color: 'var(--text-primary)',
                                   fontSize: '0.9rem',
                                   outline: 'none',
                                   transition: 'border-color 0.2s',
                                }}
                             />
                          </div>
                          <select 
                             value={roleFilter} 
                             onChange={(e) => setRoleFilter(e.target.value)} 
                             style={{
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-card)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                             }}
                          >
                             <option value="all">All Roles</option>
                             <option value="student">Student</option>
                             <option value="admin">Teacher</option>
                          </select>
                       </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                       <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                             <tr style={{ borderBottom: '2px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '1rem 0.5rem' }}>Name</th>
                                <th style={{ padding: '1rem 0.5rem' }}>Email</th>
                                <th style={{ padding: '1rem 0.5rem' }}>Role</th>
                                <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>Actions</th>
                             </tr>
                          </thead>
                          <tbody>
                             {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                <tr key={u._id} className="table-row" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                   <td style={{ padding: '1rem 0.5rem', fontWeight: '500' }}>{u.name}</td>
                                   <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                                   <td style={{ padding: '1rem 0.5rem' }}>{getRoleBadge(u.role)}</td>
                                   <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                                      <button onClick={() => handleDeleteUser(u._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'} title="Delete User">
                                         <Trash size={18} />
                                      </button>
                                   </td>
                                </tr>
                             )) : (
                                <tr>
                                   <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No users found.</td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Exams Summary Panel */}
                 <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', animation: 'fadeUp 0.5s 0.4s both' }}>
                    <h2 style={{ fontSize: '1.3rem', margin: '0 0 1.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <FileText size={20} color="var(--primary)" /> Platform Exams Overview
                    </h2>
                    <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                       <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                             <tr style={{ borderBottom: '2px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, background: 'var(--surface-panel)', zIndex: 10 }}>
                                <th style={{ padding: '1rem 0.5rem' }}>Exam Title</th>
                                <th style={{ padding: '1rem 0.5rem' }}>Author (Teacher)</th>
                                <th style={{ padding: '1rem 0.5rem' }}>Date Created</th>
                             </tr>
                          </thead>
                          <tbody>
                             {exams.length > 0 ? exams.map(ex => (
                                <tr key={ex._id} className="table-row" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                   <td style={{ padding: '1rem 0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>{ex.title} {ex.isDeleted && <span style={{color: '#ef4444', fontSize: '0.7rem', verticalAlign: 'middle', marginLeft: '0.5rem'}}>(DELETED)</span>}</td>
                                   <td style={{ padding: '1rem 0.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                         <span style={{ fontSize: '1rem' }}>👨‍🏫</span>
                                         <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{ex.createdBy ? ex.createdBy.name : 'Unknown'}</span>
                                      </div>
                                   </td>
                                   <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                                </tr>
                             )) : (
                                <tr>
                                   <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No exams configured.</td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Audit Logs panel */}
                 <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', animation: 'fadeUp 0.5s 0.5s both' }}>
                    <h2 style={{ fontSize: '1.3rem', margin: '0 0 1.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <History size={20} color="#f59e0b" /> Deletion Audit Trail
                    </h2>
                    <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                       <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                             <tr style={{ borderBottom: '2px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, background: 'var(--surface-panel)', zIndex: 10 }}>
                                <th style={{ padding: '1rem 0.5rem' }}>Exam Name</th>
                                <th style={{ padding: '1rem 0.5rem' }}>Deleted By</th>
                                <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>Timestamp</th>
                             </tr>
                          </thead>
                          <tbody>
                             {auditLogs.length > 0 ? auditLogs.map((log, idx) => (
                                <tr key={idx} className="table-row" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                   <td style={{ padding: '1rem 0.5rem', fontWeight: '600' }}>{log.examName}</td>
                                   <td style={{ padding: '1rem 0.5rem' }}>
                                      <div style={{ fontSize: '0.85rem' }}>
                                         <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{log.deletedBy.name}</div>
                                         <div style={{ color: 'var(--text-secondary)' }}>{log.deletedBy.email}</div>
                                      </div>
                                   </td>
                                   <td style={{ padding: '1rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                      {new Date(log.timestamp).toLocaleString()}
                                   </td>
                                </tr>
                             )) : (
                                <tr>
                                   <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No deletion logs found.</td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

              </div>

              {/* Right Column - Charts and Widgets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 
                 <div className="glass-panel hover-card" style={{ padding: '1.5rem', borderRadius: '16px', animation: 'fadeUp 0.5s 0.2s both' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', textAlign: 'center' }}>Role Distribution</h2>
                    <div style={{ height: '220px', position: 'relative' }}>
                       <Pie data={pieChartData} options={pieOptions} />
                    </div>
                 </div>

                 <div className="glass-panel" style={{ flex: 1, padding: '0', borderRadius: '16px', animation: 'fadeUp 0.5s 0.5s both', overflow: 'hidden' }}>
                    <LoginActivityTimeline history={activities} isDarkMode={isDarkMode} />
                 </div>

              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
