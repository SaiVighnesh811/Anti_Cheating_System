import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdminPage = window.location.pathname.startsWith('/admin');
    const isSuperAdminPage = window.location.pathname.startsWith('/superadmin');

    let storedUserStr;
    if (isAdminPage) storedUserStr = localStorage.getItem('adminUser');
    else if (isSuperAdminPage) storedUserStr = localStorage.getItem('superAdminUser');
    else storedUserStr = localStorage.getItem('studentUser');

    // Fallback if not on designated explicit paths
    if (!storedUserStr && window.location.pathname === '/') {
      storedUserStr = localStorage.getItem('studentUser') || localStorage.getItem('adminUser') || localStorage.getItem('superAdminUser');
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
      } else if (data.role === 'superadmin') {
        localStorage.setItem('superAdminUser', JSON.stringify(data));
        localStorage.setItem('superAdminToken', data.token);
      } else {
        localStorage.setItem('studentUser', JSON.stringify(data));
        localStorage.setItem('studentToken', data.token);
      }
      return data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw 'Invalid credentials. Please check your email and password.';
      }
      if (error.response?.status >= 500) {
        throw 'Server error. Please try again later.';
      }
      throw error.response?.data?.message || 'Login failed. Please check your connection.';
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
    const role = user?.role;
    setUser(null);
    if (role === 'admin') {
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminToken');
    } else if (role === 'superadmin') {
      localStorage.removeItem('superAdminUser');
      localStorage.removeItem('superAdminToken');
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
