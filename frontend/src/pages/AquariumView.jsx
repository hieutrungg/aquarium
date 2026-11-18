import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client.js';
import { canFeed, fetchTankScene, findFeedingTask, TANK_STYLES } from '../aquarium/tankSceneActions.js';
import { useGodotBridge } from '../aquarium/useGodotBridge.js';

const GAME_URL = '/aquarium/index.html';
const EXPORT_COMMAND = '& "D:/GoDot/Godot_v4.7-stable_win64.exe/Godot_v4.7-stable_win64.exe" --headless --path game --export-release "Web" ../frontend/public/aquarium/index.html';

export default function AquariumView() {
  const { id } = useParams();
  return <TankAquarium key={id} id={id} />;
}

function TankAquarium({ id }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const iframeRef = useRef(null);
  const feedAttempt = useRef(null);
  const feedInFlight = useRef(false);
  const [buildState, setBuildState] = useState('checking');
  const [buildCheck, setBuildCheck] = useState(0);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const tankQuery = {
    queryKey: ['tank', id],
    queryFn: async ({ signal }) => (await api.get(`/tanks/${id}`, { signal })).data,
    staleTime: 0,
  };
  const sceneKey = ['tankScene', id];
  const { data: dto, isPending, isError, error, refetch } = useQuery({
    queryKey: sceneKey,
    queryFn: ({ signal }) => fetchTankScene(api, id, () => queryClient.fetchQuery(tankQuery), signal),
    refetchOnWindowFocus: false,
  });

  async function onFeed() {
    showToast('Đã cho cá ăn 🐟');
    const now = Date.now();
    if (feedInFlight.current || !canFeed(now, feedAttempt.current)) return;
    feedAttempt.current = now;
    feedInFlight.current = true;
    try {
      const tank = await queryClient.fetchQuery(tankQuery);
      const task = findFeedingTask(tank.careTasks);
      if (!task) return;
      // Reserve at the actual PUT too, including when the preceding GET was slow.
      feedAttempt.current = Date.now();
      await api.put(`/tanks/${id}/care-tasks/${task._id ?? task.id}/complete`);
      await queryClient.invalidateQueries({ queryKey: ['tank', id] });
    } catch {
      showToast('Đã cho cá ăn 🐟 · Chưa ghi được lịch chăm sóc. Vui lòng thử lại sau.', true);
    } finally {
      feedInFlight.current = false;
    }
  }

  const saveScene = useMutation({
    scope: { id: `tank-scene-${id}` },
    mutationFn: async (payload) => {
      await queryClient.cancelQueries({ queryKey: sceneKey });
      const { data } = await api.put(`/tanks/${id}/scene`, {
        props: payload?.props, camera: payload?.camera,
      });
      return data;
    },
    onSuccess: async (savedDTO) => {
      await queryClient.cancelQueries({ queryKey: sceneKey });
      acknowledgeSave(savedDTO);
      queryClient.setQueryData(sceneKey, savedDTO);
      // Keep the legacy tank detail cache consistent without refetching the scene.
      queryClient.setQueryData(['tank', id], (old) => old ? {
        ...old, tank: { ...old.tank, scene: savedDTO.scene },
      } : old);
      showToast('Đã lưu bố cục');
    },
    onError: () => showToast('Chưa lưu được bố cục. Vui lòng thử lại.', true),
  });
  const changeStyle = useMutation({
    scope: { id: `tank-scene-${id}` },
    mutationFn: (style) => api.put(`/tanks/${id}`, { style }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tank', id] });
      const result = await refetch();
      showToast(result.isError ? 'Đã đổi phong cách nhưng chưa tải được cảnh. Vui lòng thử lại.' : 'Đã đổi phong cách', result.isError);
    },
    onError: () => showToast('Chưa đổi được phong cách. Vui lòng thử lại.', true),
  });
  const { ready, reset, acknowledgeSave } = useGodotBridge(iframeRef, dto, {
    onFeed,
    onSave: (payload) => saveScene.mutate(payload),
    onOpenSpecies: (payload) => {
      if (typeof payload?.speciesSlug === 'string' && payload.speciesSlug.trim()) {
        navigate(`/species/${encodeURIComponent(payload.speciesSlug)}`);
      } else showToast('Chưa có trang chi tiết cho loài này');
    },
  });
  const warnings = dto?.warnings ?? [];

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
        <h1 className="min-w-0 break-words text-2xl font-semibold">{dto?.tank?.name ?? 'Bể cá 2D'}</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <label className="flex min-w-0 flex-wrap items-center gap-2" htmlFor="tank-style">
            Phong cách
            <select
              id="tank-style"
              value={dto?.tank?.style ?? 'nature'}
              disabled={!dto || changeStyle.isPending || saveScene.isPending}
              onChange={(event) => changeStyle.mutate(event.target.value)}
              className="min-h-11 max-w-full rounded-lg bg-cozy-cream px-3 text-cozy-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cozy-ink disabled:cursor-wait disabled:opacity-60"
            >
              {Object.entries(TANK_STYLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!dto}
            aria-expanded={warningsOpen}
            aria-controls="tank-warnings"
            onClick={() => setWarningsOpen((open) => !open)}
            className="min-h-11 rounded-lg bg-cozy-accent px-4 font-medium hover:bg-cozy-water focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cozy-ink disabled:opacity-60"
          >
            {warnings.length} cảnh báo
          </button>
          <Link
            to={`/tanks/${id}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-cozy-cream px-4 font-medium hover:bg-cozy-water focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cozy-ink"
          >
            ← Quay lại bể
          </Link>
        </div>
      </header>

      {warningsOpen && (
        <section id="tank-warnings" aria-label="Cảnh báo của bể" className="mb-5 rounded-lg bg-cozy-cream p-4">
          <h2 className="font-semibold">Cảnh báo của bể</h2>
          {warnings.length ? (
            <ul className="mt-2 list-disc space-y-2 break-words pl-5">
              {warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}
            </ul>
          ) : <p className="mt-2">Bể hiện không có cảnh báo.</p>}
        </section>
      )}

      <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-4 right-4 z-50 mx-auto max-w-lg text-cozy-ink">
        {toast && (
          <div className={`flex items-start justify-between gap-3 rounded-xl border-2 border-cozy-ink p-4 ${toast.isError ? 'bg-cozy-accent' : 'bg-cozy-cream'}`}>
            <p>{toast.message}</p>
            <button type="button" aria-label="Đóng thông báo" onClick={() => setToast(null)} className="min-h-11 shrink-0 rounded px-2 font-medium hover:bg-cozy-water focus-visible:outline focus-visible:outline-2 focus-visible:outline-cozy-ink">Đóng</button>
          </div>
        )}
      </div>

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
              title={`Bể cá 2D — ${dto?.tank?.name ?? 'AquaVerse'}`}
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
