import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/tanks');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="led p-6">
        <h1 className="font-display text-xl font-bold text-white">Đăng nhập</h1>
        <p className="mb-4 text-sm text-slate-400">Tiếp tục quản lý hồ cá của bạn</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            type="email"
            placeholder="name@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Mật khẩu"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Đang xử lý…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-neon-cyan hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
}
