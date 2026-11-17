import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';

const typeLabel = { planted: 'Thủy sinh', freshwater: 'Cá cảnh', saltwater: 'Hồ biển' };

export default function MyTanks() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'planted',
    dimensions: { length: 60, width: 30, height: 36 },
  });

  const { data: tanks, isLoading } = useQuery({
    queryKey: ['tanks'],
    queryFn: async () => (await api.get('/tanks')).data,
  });

  const create = useMutation({
    mutationFn: (payload) => api.post('/tanks', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks'] });
      setShow(false);
      setForm({ name: '', type: 'planted', dimensions: { length: 60, width: 30, height: 36 } });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-white">Hồ của tôi</h1>
          <p className="text-slate-400">Quản lý tất cả hồ cá của bạn</p>
        </div>
        <button className="btn-primary" onClick={() => setShow((s) => !s)}>
          + Tạo hồ mới
        </button>
      </div>

      {show && (
        <form
          className="led grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
        >
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Tên hồ</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="vd: Hồ Iwagumi 60"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Loại hồ</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="planted">Thủy sinh</option>
              <option value="freshwater">Cá cảnh</option>
              <option value="saltwater">Hồ biển</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['length', 'width', 'height'].map((k) => (
              <div key={k}>
                <label className="text-xs text-slate-500">
                  {{ length: 'Dài', width: 'Rộng', height: 'Cao' }[k]} (cm)
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.dimensions[k]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dimensions: { ...form.dimensions, [k]: Number(e.target.value) },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Đang tạo…' : 'Lưu hồ'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : tanks?.length === 0 ? (
        <div className="led p-8 text-center text-slate-400">
          Chưa có hồ nào. Tạo hồ đầu tiên để bắt đầu! 🐠
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tanks?.map((t) => (
            <Link
              key={t._id}
              to={`/tanks/${t._id}`}
              className="led p-5 transition duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-white">{t.name}</h3>
                <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-xs text-neon-cyan">
                  {typeLabel[t.type]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {t.dimensions?.length}×{t.dimensions?.width}×{t.dimensions?.height} cm ·{' '}
                <span className="text-neon-cyan">{t.volume} lít</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
