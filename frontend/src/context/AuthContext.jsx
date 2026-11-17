import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('av_token');
    if (!token) return setLoading(false);
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('av_token'))
      .finally(() => setLoading(false));
  }, []);

  const saveAuth = ({ token, ...userData }) => {
    localStorage.setItem('av_token', token);
    setUser(userData);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveAuth(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    saveAuth(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('av_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
