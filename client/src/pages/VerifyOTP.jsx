import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const VerifyOTP = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(30); // 30 seconds before resend
  
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
      return;
    }

    // Main 5-minute countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 30-sec resend delay countdown
    const resendTimer = setInterval(() => {
      setResendCooldown(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(resendTimer);
    };
  }, [email, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      showToast('Please enter a valid 6-digit OTP', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      showToast('OTP verified successfully', 'success');
      navigate('/reset-password', { state: { email, otp } });
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid or Expired OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      showToast('OTP resent to your email successfully', 'success');
      setTimeLeft(300); // Reset 5m timer
      setResendCooldown(30); // Reset 30s delay
    } catch (err) {
      showToast('Failed to resend OTP', 'error');
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <ShieldCheck size={32} color="var(--success)" />
            </div>
            <h1 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Verify OTP</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Code sent to <strong>{email}</strong></p>
          </div>

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ margin: 0 }}>6-Digit OTP</label>
                <span style={{ fontSize: '0.85rem', color: timeLeft <= 60 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: '600' }}>
                  {timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : 'Expired'}
                </span>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                style={{ width: '100%', padding: '1rem', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: '700' }}
                required
                disabled={timeLeft === 0}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading || timeLeft === 0 || otp.length < 6} style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}>
              {loading ? <Loader2 size={20} className="spin-animation" /> : 'Verify Code'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              Didn't receive code?{' '}
              <button 
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendLoading}
                style={{ 
                  background: 'none', border: 'none', 
                  color: resendCooldown > 0 ? 'var(--text-secondary)' : 'var(--primary)', 
                  fontWeight: '600', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  padding: 0, opacity: resendCooldown > 0 ? 0.6 : 1
                }}
              >
                {resendLoading ? 'Sending...' : `Resend OTP ${resendCooldown > 0 ? `(${resendCooldown}s)` : ''}`}
              </button>
            </p>

            <button 
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              <ArrowLeft size={16} /> Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
