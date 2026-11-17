import { useState } from 'react';

export default function Tools() {
  const [dim, setDim] = useState({ l: 60, w: 30, h: 36 });
  const volume = Math.round((dim.l * dim.w * dim.h) / 1000);

  const [pct, setPct] = useState(30);
  const changeLiters = Math.round((volume * pct) / 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wide text-white">Công cụ tiện ích</h1>
        <p className="text-slate-400">Tính toán nhanh cho hồ của bạn</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="led p-5">
          <h3 className="font-display font-semibold text-white">🪣 Tính dung tích hồ</h3>
          <p className="mb-4 text-sm text-slate-400">Nhập kích thước (cm)</p>
          <div className="grid grid-cols-3 gap-3">
            {['l', 'w', 'h'].map((k) => (
              <div key={k}>
                <label className="text-xs text-slate-500">
                  {{ l: 'Dài', w: 'Rộng', h: 'Cao' }[k]}
                </label>
                <input
                  type="number"
                  className="input"
                  value={dim[k]}
                  onChange={(e) => setDim({ ...dim, [k]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-4 text-center">
            <p className="text-sm text-neon-cyan/80">Dung tích ước tính</p>
            <p
              className="font-display text-3xl font-black text-neon-cyan"
              style={{ textShadow: '0 0 18px rgba(34,245,224,0.5)' }}
            >
              {volume} lít
            </p>
          </div>
        </div>

        <div className="led p-5">
          <h3 className="font-display font-semibold text-white">💧 Tính lượng nước cần thay</h3>
          <p className="mb-4 text-sm text-slate-400">Dựa trên dung tích {volume} lít</p>
          <label className="text-xs text-slate-500">Phần trăm thay nước: {pct}%</label>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full accent-neon-pink"
          />
          <div className="mt-4 rounded-lg border border-neon-pink/30 bg-neon-pink/5 p-4 text-center">
            <p className="text-sm text-neon-pink/80">Lượng nước cần thay</p>
            <p
              className="font-display text-3xl font-black text-neon-pink"
              style={{ textShadow: '0 0 18px rgba(255,45,146,0.5)' }}
            >
              {changeLiters} lít
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
