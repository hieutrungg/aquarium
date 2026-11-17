import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const lightLabel = { low: 'Ánh sáng thấp', medium: 'Trung bình', high: 'Mạnh' };
const co2Label = { not_needed: 'Không cần CO2', optional: 'CO2 tùy chọn', required: 'Cần CO2' };
const posLabel = {
  foreground: 'Tiền cảnh',
  midground: 'Trung cảnh',
  background: 'Hậu cảnh',
  floating: 'Thả trôi',
};

export default function PlantsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => (await api.get('/plants')).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wide text-white">Cây thủy sinh</h1>
        <p className="text-slate-400">Chọn cây phù hợp với điều kiện hồ</p>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items?.map((p) => (
            <div key={p._id} className="led p-5">
              <h3 className="font-semibold text-white">{p.name}</h3>
              <p className="text-sm italic text-slate-500">{p.sciName}</p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-amber-300">
                  💡 {lightLabel[p.light]}
                </span>
                <span className="rounded-full border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-neon-green">
                  {co2Label[p.co2]}
                </span>
                <span className="chip">{posLabel[p.position]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
