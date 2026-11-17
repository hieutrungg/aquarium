import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import api from '../api/client.js';

const typeLabel = { planted: 'Thủy sinh', freshwater: 'Cá cảnh', saltwater: 'Hồ biển' };
const posLabel = {
  foreground: 'Tiền cảnh',
  midground: 'Trung cảnh',
  background: 'Hậu cảnh',
  floating: 'Thả trôi',
};
const hardscapeMeta = {
  substrate: { label: 'Nền', icon: '🟤' },
  driftwood: { label: 'Lũa', icon: '🪵' },
  rock: { label: 'Đá', icon: '🪨' },
  decoration: { label: 'Trang trí', icon: '🐚' },
  background: { label: 'Phông nền', icon: '🖼️' },
};

export default function TankDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tank', id] });

  const [log, setLog] = useState({ temp: '', pH: '', no3: '', tds: '' });
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(null);
  const [animal, setAnimal] = useState({ name: '', quantity: 1 });
  const [plant, setPlant] = useState({ name: '', position: 'midground', quantity: 1 });
  const [scape, setScape] = useState({ type: 'driftwood', name: '', quantity: 1 });
  const [showLayout, setShowLayout] = useState(false);
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tank', id],
    queryFn: async () => (await api.get(`/tanks/${id}`)).data,
  });

  const layoutQuery = useQuery({
    queryKey: ['layout', id],
    queryFn: async () => (await api.get(`/tanks/${id}/layout-suggestion`)).data,
    enabled: showLayout,
  });

  const addLog = useMutation({
    mutationFn: (p) => api.post(`/tanks/${id}/water-logs`, p),
    onSuccess: () => {
      invalidate();
      setLog({ temp: '', pH: '', no3: '', tds: '' });
    },
  });
  const completeTask = useMutation({
    mutationFn: (taskId) => api.put(`/tanks/${id}/care-tasks/${taskId}/complete`),
    onSuccess: invalidate,
  });
  const saveTank = useMutation({
    mutationFn: (p) => api.put(`/tanks/${id}`, p),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });
  const addAnimal = useMutation({
    mutationFn: (p) => api.post(`/tanks/${id}/livestock`, p),
    onSuccess: () => {
      invalidate();
      setAnimal({ name: '', quantity: 1 });
    },
  });
  const delAnimal = useMutation({
    mutationFn: (itemId) => api.delete(`/tanks/${id}/livestock/${itemId}`),
    onSuccess: invalidate,
  });
  const addPlant = useMutation({
    mutationFn: (p) => api.post(`/tanks/${id}/plants`, p),
    onSuccess: () => {
      invalidate();
      setPlant({ name: '', position: 'midground', quantity: 1 });
    },
  });
  const delPlant = useMutation({
    mutationFn: (itemId) => api.delete(`/tanks/${id}/plants/${itemId}`),
    onSuccess: invalidate,
  });
  const addScape = useMutation({
    mutationFn: (p) => api.post(`/tanks/${id}/hardscape`, p),
    onSuccess: () => {
      invalidate();
      setScape({ type: 'driftwood', name: '', quantity: 1 });
    },
  });
  const delScape = useMutation({
    mutationFn: (itemId) => api.delete(`/tanks/${id}/hardscape/${itemId}`),
    onSuccess: invalidate,
  });
  const genImage = useMutation({
    mutationFn: (p) => api.post(`/tanks/${id}/layout-image`, p).then((r) => r.data),
  });

  if (isLoading) return <p className="text-slate-500">Đang tải…</p>;
  if (!data) return <p className="text-slate-500">Không tìm thấy hồ.</p>;

  const { tank, livestock, plants, hardscape, waterLogs, careTasks } = data;
  const latest = waterLogs[0] || {};

  const chartData = [...waterLogs]
    .reverse()
    .filter((w) => w.no3 != null)
    .map((w) => ({
      date: new Date(w.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      no3: w.no3,
    }));

  const no3Warning = latest.no3 != null && latest.no3 > 30;
  const startEdit = () => {
    setEdit({
      name: tank.name,
      type: tank.type,
      dimensions: { ...tank.dimensions },
    });
    setEditing(true);
  };

  const stats = [
    { label: 'Nhiệt độ', value: latest.temp != null ? `${latest.temp}°C` : '—', glow: 'rgba(58,134,255,0.5)', color: 'text-neon-blue' },
    { label: 'pH', value: latest.pH ?? '—', glow: 'rgba(34,245,224,0.5)', color: 'text-neon-cyan' },
    { label: 'NO3', value: latest.no3 != null ? `${latest.no3} ppm` : '—', danger: no3Warning, glow: 'rgba(168,85,247,0.5)', color: 'text-neon-purple' },
    { label: 'TDS', value: latest.tds ?? '—', glow: 'rgba(168,85,247,0.5)', color: 'text-neon-purple' },
  ];

  return (
    <div className="space-y-6">
      <Link to="/tanks" className="text-sm text-neon-cyan hover:underline">
        ← Hồ của tôi
      </Link>

      {/* Header + sửa hồ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-white">{tank.name}</h1>
          <p className="text-sm text-slate-400">
            {tank.dimensions?.length}×{tank.dimensions?.width}×{tank.dimensions?.height} cm ·{' '}
            <span className="text-neon-cyan">{tank.volume} lít</span> · {typeLabel[tank.type]} · setup{' '}
            {new Date(tank.setupDate).toLocaleDateString('vi-VN')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-ghost" to={`/tanks/${id}/aquarium`}>🐠 Xem bể 2D</Link>
          <button className="btn-ghost" onClick={editing ? () => setEditing(false) : startEdit}>
            {editing ? 'Hủy' : '✎ Sửa hồ'}
          </button>
        </div>
      </div>

      {editing && edit && (
        <form
          className="led grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveTank.mutate(edit);
          }}
        >
          <div>
            <label className="text-xs text-slate-500">Tên hồ</label>
            <input
              className="input"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Loại hồ</label>
            <select
              className="input"
              value={edit.type}
              onChange={(e) => setEdit({ ...edit, type: e.target.value })}
            >
              <option value="planted">Thủy sinh</option>
              <option value="freshwater">Cá cảnh</option>
              <option value="saltwater">Hồ biển</option>
            </select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-3 gap-2">
            {['length', 'width', 'height'].map((k) => (
              <div key={k}>
                <label className="text-xs text-slate-500">
                  {{ length: 'Dài', width: 'Rộng', height: 'Cao' }[k]} (cm)
                </label>
                <input
                  type="number"
                  className="input"
                  value={edit.dimensions[k]}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      dimensions: { ...edit.dimensions, [k]: Number(e.target.value) },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <p className="sm:col-span-2 text-xs text-slate-500">
            Dung tích mới ≈{' '}
            <span className="text-neon-cyan">
              {Math.round(
                (edit.dimensions.length * edit.dimensions.width * edit.dimensions.height) / 1000
              )}{' '}
              lít
            </span>
          </p>
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={saveTank.isPending}>
              {saveTank.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}

      {/* Thẻ thông số */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border bg-panel/80 p-4 ${
              s.danger ? 'border-neon-pink/50' : 'border-white/10'
            }`}
          >
            <p className={`text-sm ${s.danger ? 'text-neon-pink' : 'text-slate-400'}`}>
              {s.label} {s.danger && '⚠'}
            </p>
            <p
              className={`font-display text-2xl font-black ${s.danger ? 'text-neon-pink' : s.color}`}
              style={{ textShadow: `0 0 16px ${s.danger ? 'rgba(255,45,146,0.5)' : s.glow}` }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {no3Warning && (
        <div className="flex items-center gap-2 rounded-lg border border-neon-pink/40 bg-neon-pink/10 px-4 py-3 text-sm text-neon-pink">
          ⚠ NO3 đang cao ({latest.no3} ppm). Nên thay 30% nước để bảo vệ cư dân.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Biểu đồ NO3 */}
        <div className="led p-5 lg:col-span-2">
          <h3 className="mb-3 font-display font-semibold text-slate-200">Xu hướng NO3</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu. Hãy ghi thông số bên dưới.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" fontSize={12} stroke="#64748b" />
                <YAxis fontSize={12} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    background: '#0d1426',
                    border: '1px solid rgba(34,245,224,0.4)',
                    borderRadius: 10,
                    color: '#e2e8f0',
                  }}
                />
                <ReferenceLine y={30} stroke="#ff2d92" strokeDasharray="4 4" label="ngưỡng 30" />
                <Line
                  type="monotone"
                  dataKey="no3"
                  stroke="#22f5e0"
                  strokeWidth={3}
                  dot={{ fill: '#22f5e0', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <form
            className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = Object.fromEntries(
                Object.entries(log)
                  .filter(([, v]) => v !== '')
                  .map(([k, v]) => [k, Number(v)])
              );
              addLog.mutate(payload);
            }}
          >
            {[
              { k: 'temp', ph: '°C' },
              { k: 'pH', ph: 'pH' },
              { k: 'no3', ph: 'NO3' },
              { k: 'tds', ph: 'TDS' },
            ].map((f) => (
              <input
                key={f.k}
                className="input"
                type="number"
                step="any"
                placeholder={f.ph}
                value={log[f.k]}
                onChange={(e) => setLog({ ...log, [f.k]: e.target.value })}
              />
            ))}
            <button className="btn-primary justify-center" disabled={addLog.isPending}>
              Ghi
            </button>
          </form>
        </div>

        {/* Lịch chăm sóc */}
        <div className="led p-5">
          <h3 className="mb-3 font-display font-semibold text-slate-200">Lịch chăm sóc</h3>
          {careTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lịch nào.</p>
          ) : (
            <ul className="space-y-2">
              {careTasks.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-panel2/60 px-3 py-2 text-sm"
                >
                  <span className={t.done ? 'text-slate-600 line-through' : 'text-slate-300'}>
                    {t.title}
                  </span>
                  <button
                    className="text-xs text-neon-cyan hover:underline"
                    onClick={() => completeTask.mutate(t._id)}
                  >
                    Xong
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ===== Cư dân + Hệ sinh thái ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cư dân */}
        <div className="led p-5">
          <h3 className="mb-3 font-display font-semibold text-slate-200">
            🐟 Cư dân ({livestock.length})
          </h3>
          <ul className="space-y-2">
            {livestock.map((l) => (
              <li
                key={l._id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-panel2/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{l.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500">×{l.quantity}</span>
                  <button
                    className="text-slate-600 hover:text-neon-pink"
                    onClick={() => delAnimal.mutate(l._id)}
                    aria-label="Xóa"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {livestock.length === 0 && <p className="text-sm text-slate-500">Chưa có cư dân.</p>}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (animal.name.trim()) addAnimal.mutate(animal);
            }}
          >
            <input
              className="input"
              placeholder="Tên loài (vd: Cá Neon)"
              value={animal.name}
              onChange={(e) => setAnimal({ ...animal, name: e.target.value })}
            />
            <input
              className="input w-16"
              type="number"
              min="1"
              value={animal.quantity}
              onChange={(e) => setAnimal({ ...animal, quantity: Number(e.target.value) })}
            />
            <button className="btn-primary px-3">+</button>
          </form>
        </div>

        {/* Cây thủy sinh */}
        <div className="led p-5">
          <h3 className="mb-3 font-display font-semibold text-slate-200">
            🌿 Cây thủy sinh ({plants.length})
          </h3>
          <ul className="space-y-2">
            {plants.map((p) => (
              <li
                key={p._id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-panel2/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  {p.name}{' '}
                  <span className="text-xs text-neon-green">· {posLabel[p.position]}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500">×{p.quantity}</span>
                  <button
                    className="text-slate-600 hover:text-neon-pink"
                    onClick={() => delPlant.mutate(p._id)}
                    aria-label="Xóa"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {plants.length === 0 && <p className="text-sm text-slate-500">Chưa có cây.</p>}
          </ul>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (plant.name.trim()) addPlant.mutate(plant);
            }}
          >
            <input
              className="input"
              placeholder="Tên cây (vd: Ráy Anubias)"
              value={plant.name}
              onChange={(e) => setPlant({ ...plant, name: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                className="input"
                value={plant.position}
                onChange={(e) => setPlant({ ...plant, position: e.target.value })}
              >
                {Object.entries(posLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                className="input w-16"
                type="number"
                min="1"
                value={plant.quantity}
                onChange={(e) => setPlant({ ...plant, quantity: Number(e.target.value) })}
              />
              <button className="btn-primary px-3">+</button>
            </div>
          </form>
        </div>

        {/* Hệ sinh thái (hardscape) */}
        <div className="led p-5">
          <h3 className="mb-3 font-display font-semibold text-slate-200">
            🪨 Hệ sinh thái ({hardscape.length})
          </h3>
          <ul className="space-y-2">
            {hardscape.map((h) => (
              <li
                key={h._id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-panel2/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  {hardscapeMeta[h.type]?.icon} {h.name}{' '}
                  <span className="text-xs text-slate-500">· {hardscapeMeta[h.type]?.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500">×{h.quantity}</span>
                  <button
                    className="text-slate-600 hover:text-neon-pink"
                    onClick={() => delScape.mutate(h._id)}
                    aria-label="Xóa"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {hardscape.length === 0 && (
              <p className="text-sm text-slate-500">Chưa có nền/lũa/đá.</p>
            )}
          </ul>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (scape.name.trim()) addScape.mutate(scape);
            }}
          >
            <input
              className="input"
              placeholder="Tên (vd: Lũa linh sam)"
              value={scape.name}
              onChange={(e) => setScape({ ...scape, name: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                className="input"
                value={scape.type}
                onChange={(e) => setScape({ ...scape, type: e.target.value })}
              >
                {Object.entries(hardscapeMeta).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>
              <input
                className="input w-16"
                type="number"
                min="1"
                value={scape.quantity}
                onChange={(e) => setScape({ ...scape, quantity: Number(e.target.value) })}
              />
              <button className="btn-primary px-3">+</button>
            </div>
          </form>
        </div>
      </div>

      {/* ===== Đề xuất layout + sinh ảnh ===== */}
      <div className="led led-slow p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-white">✨ Đề xuất layout cho hồ</h3>
          <button
            className="btn-primary"
            onClick={() => {
              setShowLayout(true);
              layoutQuery.refetch();
            }}
          >
            {showLayout ? 'Làm mới gợi ý' : 'Gợi ý layout'}
          </button>
        </div>

        {showLayout && (
          <div className="mt-4 space-y-5">
            {layoutQuery.isLoading ? (
              <p className="text-sm text-slate-500">Đang phân tích hồ…</p>
            ) : layoutQuery.data ? (
              <>
                <LayoutResult s={layoutQuery.data} />

                {/* Mô tả mong muốn + sinh ảnh */}
                <div className="rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-4">
                  <p className="font-display text-sm font-semibold text-neon-purple">
                    🎨 Xem ảnh layout thực tế (Gemini AI)
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Ảnh được tạo từ chính cây / lũa / đá / cá bạn đã nhập. Thêm mô tả mong muốn để
                    điều chỉnh.
                  </p>
                  <textarea
                    className="input mt-3 h-20 resize-none"
                    placeholder="vd: ánh sáng ấm buổi chiều, tông xanh dịu, có thác cát ở giữa…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <button
                    className="btn-primary mt-3"
                    disabled={genImage.isPending}
                    onClick={() =>
                      genImage.mutate({ style: layoutQuery.data.style, notes })
                    }
                  >
                    {genImage.isPending ? '⏳ Đang vẽ ảnh… (có thể mất ~15s)' : '🎨 Tạo ảnh layout'}
                  </button>

                  {genImage.isError && (
                    <p className="mt-3 rounded-lg border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-sm text-neon-pink">
                      {genImage.error?.response?.data?.message ||
                        'Không tạo được ảnh. Kiểm tra GEMINI_API_KEY trong backend/.env.'}
                    </p>
                  )}

                  {genImage.data?.image && (
                    <div className="mt-4">
                      <img
                        src={genImage.data.image}
                        alt="Ảnh layout hồ do Gemini tạo"
                        className="w-full rounded-xl border border-white/10"
                      />
                      <a
                        href={genImage.data.image}
                        download="aquaverse-layout.png"
                        className="mt-2 inline-block text-xs text-neon-cyan hover:underline"
                      >
                        ⬇ Tải ảnh
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Không tạo được gợi ý.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutResult({ s }) {
  const Section = ({ title, children }) => (
    <div>
      <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">{title}</p>
      {children}
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-bold text-neon-cyan">{s.style}</p>
          {s.usedYourData && (
            <span className="rounded-full border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-xs text-neon-green">
              ✓ dựa trên dữ liệu hồ của bạn
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-300">{s.description}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Hardscape gợi ý">
          <ul className="space-y-1 text-sm text-slate-300">
            {s.hardscape.map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </Section>

        <Section title="Thả cá">
          <p className="text-sm text-slate-300">{s.stocking.tip}</p>
          {s.stocking.suggestedFish?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {s.stocking.suggestedFish.map((f) => (
                <span key={f} className="chip">
                  {f}
                </span>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Cây theo vị trí">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Tiền cảnh', s.plants.foreground],
            ['Trung cảnh', s.plants.midground],
            ['Hậu cảnh', s.plants.background],
          ].map(([label, list]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-panel2/50 p-3">
              <p className="text-xs font-medium text-neon-green">{label}</p>
              {list?.length ? (
                <ul className="mt-1 text-sm text-slate-300">
                  {list.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-600">Chưa có dữ liệu cây.</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mẹo bố cục">
        <ul className="space-y-1 text-sm text-slate-300">
          {s.tips.map((t, i) => (
            <li key={i}>💡 {t}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
