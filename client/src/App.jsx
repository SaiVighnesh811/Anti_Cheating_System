import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';

import AdminDashboard from './pages/AdminDashboard';
import CreateExam from './pages/CreateExam';

import StudentDashboard from './pages/StudentDashboard';
import TakeExam from './pages/TakeExam';

const ProtectedRoute = ({ children, roleRequired }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="page-container" style={{textAlign: 'center', marginTop: '4rem'}}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roleRequired && user.role !== roleRequired) return <Navigate to="/" replace />;
  
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/admin" element={
          <ProtectedRoute roleRequired="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/create-exam" element={
          <ProtectedRoute roleRequired="admin"><CreateExam /></ProtectedRoute>
        } />
        
        <Route path="/student" element={
          <ProtectedRoute roleRequired="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/student/exam/:id" element={
          <ProtectedRoute roleRequired="student"><TakeExam /></ProtectedRoute>
        } />
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
