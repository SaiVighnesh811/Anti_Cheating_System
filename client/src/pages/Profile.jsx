import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Upload, User, Mail, Save, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhoto || null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/user/profile');
        setName(res.data.name || '');
        setPhotoPreview(res.data.profilePhoto || null);
        updateUser(res.data);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    };
    if (user) {
      fetchUser();
    }
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image size should be less than 2MB', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showToast('Only JPG and PNG are allowed', 'error');
        return;
      }
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    if (selectedFile) {
      formData.append('profilePhoto', selectedFile);
    }

    try {
      const response = await api.put('/user/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // Optionally response.data contains the updated user
      updateUser(response.data);
      showToast('Profile updated successfully ✅', 'success');
      
      // Optionally redirect back to previous
      // navigate(-1);
    } catch (err) {
      console.error(err);
      showToast('Error updating profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dashboard)' }}>
      {/* Header */}
      <header className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Profile Settings</h2>
        </div>
        <div style={{ padding: '0.4rem 1rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem' }}>
          Role: <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', animation: 'fadeIn 0.4s ease-out' }}>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Photo Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '2rem' }}>
              <div 
                style={{ 
                  width: '120px', height: '120px', borderRadius: '50%', 
                  background: 'var(--primary-light)', border: '4px solid var(--surface-panel)', 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
                className="profile-avatar-hover"
                onClick={() => document.getElementById('photo-upload').click()}
              >
                {photoPreview ? (
                  <img src={photoPreview.startsWith('blob:') ? photoPreview : `http://localhost:5000${photoPreview}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '3rem', color: 'var(--primary)', fontWeight: 'bold' }}>{name?.charAt(0)?.toUpperCase()}</span>
                )}
                
                <div className="avatar-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: 'white' }}>
                  <Upload size={24} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="file" id="photo-upload" accept="image/png, image/jpeg" style={{ display: 'none' }} onChange={handleImageChange} />
                <button type="button" onClick={() => document.getElementById('photo-upload').click()} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Change Photo
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Allowed formats: JPG, PNG. Max size: 2MB.</p>
            </div>

            {/* Inputs Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field-enhanced"
                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: '10px', border: '1px solid var(--surface-border)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'white', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input-field-enhanced"
                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: '10px', border: '1px solid var(--surface-border)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Email address cannot be changed.</p>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem' }}>
               <button 
                type="submit" 
                className="btn-primary" 
                disabled={isSubmitting}
                style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? <Clock size={18} className="spin" /> : <Save size={18} />}
                {isSubmitting ? 'Saving Changes...' : 'Save Profile ✅'}
              </button>
            </div>

          </form>
        </div>
      </main>

      <style>{`
        .profile-avatar-hover:hover .avatar-overlay {
          opacity: 1 !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Profile;
