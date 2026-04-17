import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    
    try {
      const user = await login(email, password);
      
      if (user.role === 'superadmin') {
        showToast('Welcome Super Admin 👑', 'success');
      } else {
        showToast('Login successful! Welcome back.', 'success');
      }
      
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-background" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel slide-up-anim" style={{ 
        width: '100%', maxWidth: '450px', padding: '3.5rem 3rem', 
        background: '#fff', border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-block', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '16px', marginBottom: '1.25rem' }}>
             <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Login to your account</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: '500' }}>Access your secure portal</p>
        </div>

        {error && (
          <div className="error-message-anim" style={{ background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)', padding: '1.25rem', marginBottom: '2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '600' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Enter Email</label>
            <input 
              type="email" 
              className="input-field-enhanced"
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
            />
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔒 Enter Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '700' }}>Forgot Password?</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="input-field-enhanced"
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '1rem 3.5rem 1rem 1.25rem', borderRadius: '12px', border: error && password.length > 0 && password.length < 6 ? '1.5px solid var(--danger)' : '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error === 'Password must be at least 6 characters long' && (
              <small className="error-text-anim" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.2rem', display: 'block' }}>{error}</small>
            )}
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1.1rem', fontSize: '1.1rem', fontWeight: '700', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Login 🚀'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Create Account</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
