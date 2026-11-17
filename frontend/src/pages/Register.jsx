import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/tanks');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="led p-6">
        <h1 className="font-display text-xl font-bold text-white">Tạo tài khoản</h1>
        <p className="mb-4 text-sm text-slate-400">Miễn phí — bắt đầu quản lý hồ cá</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            placeholder="Tên của bạn"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
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
            placeholder="Mật khẩu (tối thiểu 6 ký tự)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            required
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Đang xử lý…' : 'Đăng ký'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-neon-cyan hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
