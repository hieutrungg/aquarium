import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/species', label: 'Thư viện' },
  { to: '/plants', label: 'Cây thủy sinh' },
  { to: '/articles', label: 'Bài viết' },
  { to: '/tools', label: 'Công cụ' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-base/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-neon-cyan"
          style={{ textShadow: '0 0 12px rgba(34,245,224,0.6)' }}
        >
          <span>🐠</span> AQUAVERSE
        </Link>

        <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive
                  ? 'text-neon-cyan'
                  : 'transition hover:text-neon-cyan'
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/tanks" className="btn-ghost hidden sm:inline-flex">
                Hồ của tôi
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-sm text-slate-400 transition hover:text-neon-pink"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-300 transition hover:text-neon-cyan">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn-primary">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
