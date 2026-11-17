import { Link } from 'react-router-dom';

const features = [
  { icon: '🐟', title: 'Quản lý hồ', desc: 'Cư dân, thiết bị, chi phí', to: '/tanks', color: 'text-neon-cyan' },
  { icon: '📈', title: 'Thông số nước', desc: 'Log pH, NO3 + biểu đồ', to: '/tanks', color: 'text-neon-blue' },
  { icon: '📚', title: 'Thư viện loài', desc: 'Cá, tép, cây thủy sinh', to: '/species', color: 'text-neon-purple' },
  { icon: '🧮', title: 'Công cụ', desc: 'Tính lít, tương thích cá', to: '/tools', color: 'text-neon-pink' },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="led led-slow overflow-hidden px-6 py-20 text-center">
        <span className="inline-block rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-1 text-xs font-medium uppercase tracking-widest text-neon-cyan">
          ▸ Quản lý hồ &amp; học thủy sinh — miễn phí
        </span>
        <h1
          className="mt-5 font-display text-4xl font-black tracking-tight text-white md:text-5xl"
          style={{ textShadow: '0 0 25px rgba(34,245,224,0.45)' }}
        >
          CHĂM HỒ CÁ CỦA BẠN,{' '}
          <span className="bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink bg-clip-text text-transparent">
            ĐÚNG CÁCH
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Tra cứu loài cá, theo dõi thông số nước, cài lịch chăm sóc và nhận cảnh báo khi
          hồ có bất thường.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link to="/tanks" className="btn-primary">
            ⚡ Tạo hồ đầu tiên
          </Link>
          <Link to="/species" className="btn-ghost">
            Khám phá thư viện
          </Link>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            to={f.to}
            className="led group p-5 transition duration-300 hover:-translate-y-1.5"
          >
            <div className={`text-3xl ${f.color}`}>{f.icon}</div>
            <h3 className="mt-3 font-display font-semibold tracking-wide text-white">{f.title}</h3>
            <p className="text-sm text-slate-400">{f.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
