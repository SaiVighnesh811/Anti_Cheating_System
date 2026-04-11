import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdminPage = window.location.pathname.startsWith('/admin');
    let storedUserStr = isAdminPage 
      ? localStorage.getItem('adminUser') 
      : localStorage.getItem('studentUser');
    
    // Fallback if not on designated explicit paths
    if (!storedUserStr && window.location.pathname === '/') {
        storedUserStr = localStorage.getItem('studentUser') || localStorage.getItem('adminUser');
    }

    if (storedUserStr) {
      setUser(JSON.parse(storedUserStr));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setUser(data);
      if (data.role === 'admin') {
        localStorage.setItem('adminUser', JSON.stringify(data));
        localStorage.setItem('adminToken', data.token);
      } else {
        localStorage.setItem('studentUser', JSON.stringify(data));
        localStorage.setItem('studentToken', data.token);
      }
      return data;
    } catch (error) {
      throw error.response?.data?.message || 'Login failed';
    }
  };

  const register = async (name, email, password, role) => {
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role });
      setUser(data);
      if (data.role === 'admin') {
        localStorage.setItem('adminUser', JSON.stringify(data));
        localStorage.setItem('adminToken', data.token);
      } else {
        localStorage.setItem('studentUser', JSON.stringify(data));
        localStorage.setItem('studentToken', data.token);
      }
      return data;
    } catch (error) {
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  const logout = () => {
    const isAdmin = user?.role === 'admin';
    setUser(null);
    if (isAdmin) {
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminToken');
    } else {
      localStorage.removeItem('studentUser');
      localStorage.removeItem('studentToken');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
