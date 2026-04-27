import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// ── Helpers: use sessionStorage so each tab has its own isolated session ──────
const saveSession = (data) => {
  sessionStorage.setItem('authUser', JSON.stringify(data));
  sessionStorage.setItem('authToken', data.token);
};

const clearSession = () => {
  sessionStorage.removeItem('authUser');
  sessionStorage.removeItem('authToken');
};

// ── Also keep a single localStorage key for theme persistence only ────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from THIS tab's sessionStorage only
  useEffect(() => {
    const storedUserStr = sessionStorage.getItem('authUser');
    if (storedUserStr) {
      try {
        setUser(JSON.parse(storedUserStr));
      } catch {
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });

      // Store in THIS tab's sessionStorage only — other tabs are unaffected
      clearSession();
      saveSession(data);
      setUser(data);
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
      clearSession();
      saveSession(data);
      setUser(data);
      return data;
    } catch (error) {
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  const logout = () => {
    setUser(null);
    clearSession();
  };

  const updateUser = (updatedUser) => {
    // Preserve the token from the existing session
    const token = updatedUser.token || sessionStorage.getItem('authToken');
    const merged = { ...updatedUser, token };
    setUser(merged);
    saveSession(merged);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
