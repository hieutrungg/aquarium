import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

const categoryLabel = {
  setup: 'Setup hồ',
  maintenance: 'Bảo trì',
  aquascaping: 'Bố cục',
  health: 'Sức khỏe',
  guide: 'Hướng dẫn',
};

export default function Articles() {
  const { data, isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: async () =>
      (await api.get('/articles', { params: { status: 'published' } })).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wide text-white">
          Bài viết &amp; hướng dẫn
        </h1>
        <p className="text-slate-400">Kiến thức thủy sinh từ cơ bản đến nâng cao</p>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {data?.items?.map((a) => (
            <article key={a._id} className="led p-5">
              <span className="rounded-full border border-neon-purple/40 bg-neon-purple/10 px-2 py-0.5 text-xs text-neon-purple">
                {categoryLabel[a.category]}
              </span>
              <h3 className="mt-2 font-semibold text-white">{a.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-slate-400">{a.excerpt}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
