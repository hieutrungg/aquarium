import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-500">
        <span className="font-display tracking-widest text-neon-cyan">AQUAVERSE</span>
        {' '}— Quản lý cá cảnh &amp; kiến thức thủy sinh
      </footer>
    </div>
  );
}
