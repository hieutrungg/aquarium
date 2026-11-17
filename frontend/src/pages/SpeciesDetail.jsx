import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const temperamentLabel = {
  peaceful: 'Hiền',
  'semi-aggressive': 'Hơi dữ',
  aggressive: 'Hung dữ',
};
const dietLabel = { herbivore: 'Ăn thực vật', carnivore: 'Ăn thịt', omnivore: 'Ăn tạp' };

export default function SpeciesDetail() {
  const { slug } = useParams();
  const { data: s, isLoading, isError } = useQuery({
    queryKey: ['species', slug],
    queryFn: async () => (await api.get(`/species/${slug}`)).data,
  });

  if (isLoading) return <p className="text-slate-500">Đang tải…</p>;
  if (isError || !s) return <p className="text-slate-500">Không tìm thấy loài.</p>;

  const stats = [
    { label: '🌡 Nhiệt độ', value: `${s.tempRange?.min}–${s.tempRange?.max}°C` },
    { label: '🧪 pH', value: `${s.phRange?.min}–${s.phRange?.max}` },
    { label: '📏 Kích thước', value: `${s.adultSize} cm` },
    { label: '😠 Tính cách', value: temperamentLabel[s.temperament] },
    { label: '🍽 Chế độ ăn', value: dietLabel[s.diet] },
    { label: '🪣 Hồ tối thiểu', value: `${s.minTankSize} L` },
  ];

  return (
    <div className="space-y-6">
      <Link to="/species" className="text-sm text-neon-cyan hover:underline">
        ← Quay lại thư viện
      </Link>

      <div className="led led-slow overflow-hidden">
        <div className="flex items-center gap-4 border-b border-white/10 bg-neon-cyan/5 p-6">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-cyan/15 text-3xl"
            style={{ boxShadow: '0 0 20px rgba(34,245,224,0.4)' }}
          >
            🐟
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">{s.commonName}</h1>
            <p className="italic text-neon-cyan/80">{s.sciName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
          {stats.map((st) => (
            <div key={st.label} className="bg-panel p-4">
              <p className="text-xs text-slate-500">{st.label}</p>
              <p className="font-semibold text-slate-100">{st.value}</p>
            </div>
          ))}
        </div>

        <div className="p-6">
          <p className="leading-relaxed text-slate-300">{s.description}</p>
          {s.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.tags.map((t) => (
                <span key={t} className="chip">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
