import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const isAdminPage = window.location.pathname.startsWith('/admin');
  const token = isAdminPage 
    ? localStorage.getItem('adminToken') 
    : localStorage.getItem('studentToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
