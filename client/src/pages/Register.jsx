import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validations
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      const user = await register(name, email, password, role);
      showToast('Account created successfully! Welcome.', 'success');
      
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
    <div className="login-background" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
      <div className="glass-panel slide-up-anim" style={{ 
        width: '100%', maxWidth: '500px', padding: '3.5rem 3rem', 
        background: '#fff', border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-block', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '16px', marginBottom: '1.25rem' }}>
             <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Create your account</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: '500' }}>Enter your details to register</p>
        </div>

        {error && (
          <div className="error-message-anim" style={{ background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)', padding: '1.25rem', marginBottom: '2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '600' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Enter Name</label>
            <input 
              type="text" 
              className="input-field-enhanced"
              placeholder="Enter your name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.9rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
            />
          </div>

          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📧 Enter Email</label>
            <input 
              type="email" 
              className="input-field-enhanced"
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.9rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
            />
          </div>

          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔑 Enter Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="input-field-enhanced"
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.9rem 3.5rem 0.9rem 1.25rem', borderRadius: '12px', border: error && password.length > 0 && password.length < 6 ? '1.5px solid var(--danger)' : '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
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

          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔄 Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showConfirm ? "text" : "password"} 
                className="input-field-enhanced"
                placeholder="Confirm your password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.9rem 3.5rem 0.9rem 1.25rem', borderRadius: '12px', border: error === 'Passwords do not match' ? '1.5px solid var(--danger)' : '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease' }}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error === 'Passwords do not match' && (
              <small className="error-text-anim" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.2rem', display: 'block' }}>{error}</small>
            )}
          </div>

          <div className="input-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛡️ Account Role</label>
            <select 
              className="input-field-enhanced"
              style={{ width: '100%', padding: '0.9rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', transition: 'all 0.2s ease', background: 'white' }}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="admin">Teacher</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1.1rem', fontSize: '1.1rem', fontWeight: '700', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Processing...' : 'Create Account ✨'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
