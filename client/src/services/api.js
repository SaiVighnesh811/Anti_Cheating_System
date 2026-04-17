import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const isAdminPage = window.location.pathname.startsWith('/admin');
  const isSuperAdminPage = window.location.pathname.startsWith('/superadmin');

  let token;
  if (isAdminPage) token = localStorage.getItem('adminToken');
  else if (isSuperAdminPage) token = localStorage.getItem('superAdminToken');
  else token = localStorage.getItem('studentToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
