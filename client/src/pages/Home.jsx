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
    <div className="home-container">
      {/* Background Shapes */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      <div className="bg-shape shape-3"></div>

      {/* Navigation */}
      <nav className="home-nav">
        <div className="nav-logo">
          <ShieldCheck size={28} color="#a78bfa" />
          <span>SmartExams</span>
        </div>
        <div className="nav-links">
          <button className="btn-secondary" onClick={() => navigate('/login')}>
            Log In
          </button>
          <button className="btn-primary" onClick={() => navigate('/register')}>
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">✨ Next-Generation Assessment Platform</div>
        <h1 className="hero-title">Secure & Smart Exam Integrity System</h1>
        <p className="hero-subtitle">
          Conduct online examinations with confidence. Our advanced platform ensures authenticity using real-time monitoring and intelligent anti-cheat detection, providing a seamless and secure experience for both instructors and students.
        </p>
        <div className="hero-buttons">
          <button className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }} onClick={() => navigate('/register')}>
            Get Started <Zap size={20} />
          </button>
          <button className="btn-secondary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }} onClick={() => {
            featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" ref={featuresRef}>
        <h2 className="section-title">Powerful Capabilities</h2>
        <div className="features-grid">
          
          <div className="glass-panel feature-card" style={{ animationDelay: '0.1s' }}>
            <div className="feature-icon-wrapper">
              <Eye size={32} />
            </div>
            <h3 className="feature-title">Real-Time Monitoring 👁️</h3>
            <p className="feature-desc">Active observation algorithms keep track of student activities throughout the duration of the examination.</p>
          </div>
          
          <div className="glass-panel feature-card" style={{ animationDelay: '0.2s' }}>
            <div className="feature-icon-wrapper">
              <ShieldCheck size={32} />
            </div>
            <h3 className="feature-title">Tab Switch Detection 🚫</h3>
            <p className="feature-desc">Prevents and records unauthorized navigation out of the exam environment, ensuring strict test conditions.</p>
          </div>

          <div className="glass-panel feature-card" style={{ animationDelay: '0.3s' }}>
            <div className="feature-icon-wrapper">
              <Lock size={32} />
            </div>
            <h3 className="feature-title">Secure Fullscreen 🔒</h3>
            <p className="feature-desc">Enforces a mandatory fullscreen lockdown mode, logging immediate violations if the exam window is minimized.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} SmartExams Integrity System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
