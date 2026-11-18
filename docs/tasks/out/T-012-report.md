# T-012 — Cá sống động
Đã thêm 5 hồ sơ loài, sprite/pivot + shader uốn nguyên pixel, squash/lật, fallback PlaceholderFish.
FishBrain đủ 9 trạng thái; steering/gia tốc, tầng mềm, né nền, Cory sục đáy và đớp khí 40–90s.
Boids hash 32px cập nhật mỗi frame; cohesion/alignment/separation cùng loài, tính luân phiên 2 frame/cá.
Đã có F/nút cho ăn, mồi chìm/tan, ăn/khựng, gõ kính, viền, thẻ/cảnh báo, Bridge, camera và Esc.
`-- --demo-feed`: thả mồi frame 60, gõ kính 180, highlight + info 240; `--stress`: 100 Neon + 20 cá khác.
T-010 chỉ sửa chỗ spawn cá trong TankView; giữ API, FishBack tint, lớp/nền/cây/shader; không sửa LayoutSolver.
Bridge thêm chọn DTO stress; export preset thêm `data/*.json`; DTO mẫu sửa angelfish `wander` → `hover`.
Headless import exit 0; FishLogic, FishIntegration và EnvironmentSmoke PASS; không lỗi script/shader.
FishLogic: hash so với vét cạn, 120 cá × 2000 bước, water rect/nền và Cory ≤12px ngoài surface_gulp.
600 frame sau 180 warmup, headless: 29 cá CPU FishWorld 0.713 ms; TIME_PROCESS trung bình 7.398 ms/frame.
120 cá CPU FishWorld 4.016 ms; TIME_PROCESS trung bình 11.226 ms/frame; wall tương ứng 6.900 / 6.947 ms.
Đây là số đo CPU/headless, chưa xác nhận GPU hoặc ≥60 FPS desktop; không chạy movie/cửa sổ/export Web.
Sandbox vẫn báo root certificate store như T-010; không đổi TLS. APPDATA/LOCALAPPDATA trỏ game/build/.
Lệnh kiểm tra trong README; log gitignored `build/t012-*.log`; kiểm tra UI tĩnh không có finding.
