import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Gắn token vào mọi request nếu đã đăng nhập
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('av_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
