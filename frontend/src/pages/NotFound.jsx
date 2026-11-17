import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="text-5xl">🐟</div>
      <h1
        className="mt-4 font-display text-3xl font-black text-neon-cyan"
        style={{ textShadow: '0 0 20px rgba(34,245,224,0.5)' }}
      >
        404 — LẠC MẤT RỒI
      </h1>
      <p className="mt-2 text-slate-400">Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="btn-primary mt-6">
        Về trang chủ
      </Link>
    </div>
  );
}
