import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const user = await register(name, email, password, role);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-background">
      <div className="glass-panel auth-panel">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title" style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Get started with the Exam Portal</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem', marginBottom: '1.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Full Name</label>
            <div style={{ position: 'relative' }}>
              <div className="input-emoji">👤</div>
              <input 
                type="text" 
                className="input-field-enhanced"
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <div className="input-emoji">📧</div>
              <input 
                type="email" 
                className="input-field-enhanced"
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <div className="input-emoji">🔒</div>
              <input 
                type="password" 
                className="input-field-enhanced"
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Account Role</label>
            <div style={{ position: 'relative' }}>
              <div className="input-emoji">🛡️</div>
              <select 
                className="input-field-enhanced"
                style={{ appearance: 'none' }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="student">Student</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>Sign In here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
