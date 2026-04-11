import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, Lock, Zap } from 'lucide-react';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const featuresRef = useRef(null);
  
  // Intersection Observer for slide-up animation on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach((card) => observer.observe(card));
    
    return () => {
      cards.forEach((card) => observer.unobserve(card));
    };
  }, []);

  return (
    <div className="home-container" style={{ background: '#fff' }}>
      {/* Background Shapes */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      <div className="bg-shape shape-3"></div>

      {/* Navigation */}
      <nav className="home-nav" style={{ background: 'rgba(255,255,255,0.7)' }}>
        <div className="nav-logo">
          <ShieldCheck size={30} color="var(--primary)" />
          <span>ProctorVision</span>
        </div>
        <div className="nav-links">
          <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontWeight: '700' }}>
            Portal Access
          </button>
          <button className="btn-primary" onClick={() => navigate('/register')} style={{ padding: '0.6rem 1.5rem', fontWeight: '700' }}>
            Initialize Registration
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section" style={{ animation: 'fadeIn 1s ease-out' }}>
        <div className="hero-badge">Next-Generation Assessment Integrity</div>
        <h1 className="hero-title">Secure & Intelligent Proctored Exams</h1>
        <p className="hero-subtitle">
          Engineered for academic integrity. Our platform combines real-time monitoring with advanced anti-cheat detection to ensure a transparent and secure examination environment.
        </p>
        <div className="hero-buttons">
          <button className="btn-primary" style={{ padding: '1.1rem 2.5rem', fontSize: '1rem', fontWeight: '700' }} onClick={() => navigate('/register')}>
            Get Started Professional <Zap size={18} style={{ marginLeft: '0.5rem' }} />
          </button>
          <button className="btn-secondary" style={{ padding: '1.1rem 2.5rem', fontSize: '1rem', fontWeight: '700' }} onClick={() => {
            featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Platform Capabilities
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" ref={featuresRef}>
        <h2 className="section-title" style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Advanced Security Stack</h2>
        <div className="features-grid">
          
          <div className="glass-panel feature-card" style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.03)', animationDelay: '0.1s' }}>
            <div className="feature-icon-wrapper">
              <Eye size={28} />
            </div>
            <h3 className="feature-title">Real-Time Surveillance</h3>
            <p className="feature-desc">Active algorithms monitor candidate behavior throughout the session, ensuring continuous integrity verification.</p>
          </div>
          
          <div className="glass-panel feature-card" style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.03)', animationDelay: '0.2s' }}>
            <div className="feature-icon-wrapper">
              <ShieldCheck size={28} />
            </div>
            <h3 className="feature-title">Navigation Lockdown</h3>
            <p className="feature-desc">Prevents unauthorized window or tab switching, enforcing a dedicated focus environment for all assessments.</p>
          </div>

          <div className="glass-panel feature-card" style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.03)', animationDelay: '0.3s' }}>
            <div className="feature-icon-wrapper">
              <Lock size={28} />
            </div>
            <h3 className="feature-title">Mandatory Fullscreen</h3>
            <p className="feature-desc">Enforces full-screen mode globally, logging violations immediately if the secure environment is compromised.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p style={{ fontWeight: '500', color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} ProctorVision Integrity Solutions. Engineering Academic Excellence.</p>
      </footer>
    </div>
  );
};

export default Home;
