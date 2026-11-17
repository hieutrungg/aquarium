# AquaVerse Tank — Godot 4.7

Chạy từ thư mục gốc repo, bằng PowerShell. `$godot` phải trỏ tới **file .exe**;
nếu gói Godot được giải nén thành thư mục cùng tên, chọn file .exe bên trong.

```powershell
$godot = 'D:/GoDot/Godot_v4.7-stable_win64.exe'
if (Test-Path -LiteralPath $godot -PathType Container) {
  $godot = Join-Path $godot 'Godot_v4.7-stable_win64.exe'
}
# Mở editor
& $godot --editor --path game
# Import và kiểm tra script
& $godot --headless --path game --import --quit
# Chạy mẫu offline (29 cá)
& $godot --path game
# Export Web single-thread (cần export templates 4.7.stable)
New-Item -ItemType Directory -Force frontend/public/aquarium | Out-Null
& $godot --headless --path game --export-release 'Web' ../frontend/public/aquarium/index.html
# Chạy frontend
cd frontend
npm run dev
```

Mở `/tanks/:id/aquarium` sau khi đăng nhập. React lấy API rồi gửi TankScene DTO
qua `postMessage` khi Godot phát `ready`. Hai phía kiểm tra cùng origin và cửa sổ
gửi. Không mở bản export bằng `file://`; phục vụ qua Vite hoặc HTTP cùng origin.
Các file export trong `frontend/public/aquarium/` đã được gitignore ở repo.

Desktop tự đọc `data/dev/sample_scene_nature.json` sau một frame. Web chờ dữ liệu
từ React. Cá hiện là hình học 12×6, hoặc dùng `assets/fish/<speciesKey>.png`
nếu có. Giới hạn 120 cá; HUD hiển thị số cá thực sự được dựng. Bể rộng hơn 640px
hỗ trợ giữ chuột trái để kéo ngang hoặc phím ← → khi iframe có focus.
Nút **Cho ăn** mới ghi log, chưa cập nhật lịch chăm sóc.
