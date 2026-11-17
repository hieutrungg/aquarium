import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const difficultyLabel = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };
const difficultyColor = {
  easy: 'border-neon-green/40 bg-neon-green/10 text-neon-green',
  medium: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  hard: 'border-neon-pink/40 bg-neon-pink/10 text-neon-pink',
};

export default function SpeciesList() {
  const [q, setQ] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['species', q, difficulty],
    queryFn: async () => {
      const params = {};
      if (q) params.q = q;
      if (difficulty) params.difficulty = difficulty;
      const res = await api.get('/species', { params });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wide text-white">Thư viện loài</h1>
        <p className="text-slate-400">Tra cứu cá, tép, ốc cho hồ của bạn</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Tìm theo tên… (vd: betta)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input max-w-[180px]"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">Mọi độ khó</option>
          <option value="easy">Dễ</option>
          <option value="medium">Trung bình</option>
          <option value="hard">Khó</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items?.map((s) => (
            <Link
              key={s._id}
              to={`/species/${s.slug}`}
              className="led p-5 transition duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{s.commonName}</h3>
                  <p className="text-sm italic text-slate-500">{s.sciName}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${difficultyColor[s.difficulty]}`}
                >
                  {difficultyLabel[s.difficulty]}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-400">{s.description}</p>
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                <span>🌡 {s.tempRange?.min}–{s.tempRange?.max}°C</span>
                <span>📏 {s.adultSize} cm</span>
                <span>🪣 ≥{s.minTankSize}L</span>
              </div>
            </Link>
          ))}
          {data?.items?.length === 0 && (
            <p className="text-slate-500">Không tìm thấy loài phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}
