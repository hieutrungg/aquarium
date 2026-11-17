import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';
import { toTankSceneDTO } from '../aquarium/toTankSceneDTO.js';
import { useGodotBridge } from '../aquarium/useGodotBridge.js';

const GAME_URL = '/aquarium/index.html';
const EXPORT_COMMAND = '& "D:/GoDot/Godot_v4.7-stable_win64.exe/Godot_v4.7-stable_win64.exe" --headless --path game --export-release "Web" ../frontend/public/aquarium/index.html';

export default function AquariumView() {
  const { id } = useParams();
  const iframeRef = useRef(null);
  const [buildState, setBuildState] = useState('checking');
  const [buildCheck, setBuildCheck] = useState(0);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['tank', id],
    queryFn: async () => (await api.get('/tanks/' + id)).data,
  });
  const dto = useMemo(() => data ? toTankSceneDTO(data) : null, [data]);
  const { ready, reset } = useGodotBridge(iframeRef, dto);

  useEffect(() => {
    const controller = new AbortController();
    setBuildState('checking');
    reset();
    async function checkBuild() {
      try {
        const response = await fetch(GAME_URL, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
        let exists = response.ok;
        // Vite and some hosts return the React SPA with status 200 for missing files.
        // Confirm it is Godot's shell when HEAD cannot distinguish that fallback.
        if (exists) {
          const shell = await fetch(GAME_URL, { cache: 'no-store', signal: controller.signal });
          const html = await shell.text();
          exists = shell.ok && /\bnew\s+Engine\s*\(/.test(html) && /\bGODOT_CONFIG\b/.test(html);
        }
        if (!controller.signal.aborted) setBuildState(exists ? 'available' : 'missing');
      } catch (cause) {
        if (!controller.signal.aborted) setBuildState('missing');
      }
    }
    checkBuild();
    return () => controller.abort();
  }, [buildCheck, reset]);

  return (
    <div className="rounded-2xl bg-cozy-bg p-4 text-cozy-ink sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold">{data?.tank?.name ?? 'Bể cá 2D'}</h1>
        <Link
          to={`/tanks/${id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-cozy-cream px-4 font-medium hover:bg-cozy-water focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cozy-ink"
        >
          ← Quay lại bể
        </Link>
      </header>

      {isPending ? (
        <p role="status" className="py-8">Đang tải dữ liệu bể…</p>
      ) : isError ? (
        <div role="alert" className="rounded-lg bg-cozy-cream p-5">
          <p>{error?.response?.data?.message ?? 'Chưa tải được dữ liệu bể. Vui lòng thử lại.'}</p>
          <button className="mt-3 min-h-11 rounded-lg bg-cozy-accent px-4 font-medium" onClick={() => refetch()}>Thử lại</button>
        </div>
      ) : buildState === 'missing' ? (
        <div className="rounded-lg border border-cozy-ink bg-cozy-cream p-5" role="status">
          <h2 className="text-lg font-semibold">Bể 2D chưa được xuất bản trên máy này</h2>
          <p className="mt-2">Chạy lệnh export sau từ thư mục gốc dự án bằng PowerShell, rồi kiểm tra lại.</p>
          <pre className="mt-3 overflow-x-auto rounded bg-cozy-bg p-3 text-sm"><code>{EXPORT_COMMAND}</code></pre>
          <p className="mt-2 text-sm">Tạo thư mục frontend/public/aquarium trước nếu chưa có. Nếu đường dẫn Godot là thư mục giải nén, dùng file .exe bên trong. Xem thêm game/README.md.</p>
          <button className="mt-4 min-h-11 rounded-lg bg-cozy-accent px-4 font-medium" onClick={() => setBuildCheck((value) => value + 1)}>Kiểm tra lại</button>
        </div>
      ) : (
        <div className="relative aspect-video overflow-hidden rounded-xl border-2 border-cozy-ink bg-cozy-bg">
          {buildState === 'available' && (
            <iframe
              ref={iframeRef}
              src={GAME_URL}
              title={`Bể cá 2D — ${data?.tank?.name ?? 'AquaVerse'}`}
              className="absolute inset-0 h-full w-full border-0"
              onError={() => setBuildState('missing')}
            />
          )}
          {!ready && <p role="status" className="pointer-events-none absolute bottom-3 left-3 right-3 rounded bg-cozy-cream px-3 py-2 text-sm">{buildState === 'checking' ? 'Đang kiểm tra bể 2D…' : 'Đang khởi động bể 2D…'}</p>}
        </div>
      )}
    </div>
  );
}
