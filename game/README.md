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

## Môi trường Nature (T-010)

`pixel_stage.tscn` là khung cửa sổ: `Frame/Viewport` render **640×360**, filter Nearest,
phóng theo số nguyên và căn giữa. `PixelStage.gd` tắt stretch của Window lúc chạy;
stretch viewport được thực hiện bằng SubViewportContainer để vùng thừa dùng clear color
`#EAF6F2` thay vì margin đen của engine. Cửa sổ 800×600 đặt vùng game tại `(80, 120)`.
Khung nhỏ hơn 640×360 giữ 1× và cắt đều hai phía, giống giới hạn integer scaling.
`project.godot` cũng đặt clear/splash màu mint; Web preset thêm CSS cho body/canvas/status.
Không cần sửa trang React để tô viền bên trong canvas.

Scene nội dung vẫn là `scenes/main.tscn`, nằm tại `Frame/Viewport/Main` trong khung cửa sổ.
`Main/TankView` dựng các Node2D con theo thứ tự sau → trước:

```
Wall           tường, kệ gỗ, đèn treo
WaterBack      nước, GodRays, WaterCaustics (nửa dưới)
HardscapeBack  lũa/đá hậu cảnh
PlantsBack     cây cao hậu cảnh
FishBack       ~35% cá, modulate pha #8FC9BA 30%
HardscapeMid   đá chính/phụ
PlantsMid      ráy/dương xỉ quanh đá
FishFront      cá lớp gần
Substrate      tile nền dốc + SubstrateCaustics
PlantsFront    thảm cỏ/rêu
Particles      40 hạt 1px + 18 bọt 1–3px nếu có filter/co2
Surface        mặt nước gợn 1–2px
Glass          viền kính, phản chiếu, WaterTint
```

HUD ở CanvasLayer của Main, dùng chung `ui/cozy_theme.tres` cho label và nút,
có trạng thái hover/pressed/disabled và viền focus khi dùng bàn phím.

API dành cho task cá/hiệu ứng tiếp theo:

```gdscript
TankView.get_water_rect() -> Rect2
TankView.get_substrate_y(x: float) -> float  # x/y theo tọa độ thế giới trong Main
TankView.fish_layers() -> Array[Node2D]      # [FishBack, FishFront], rỗng trước lần build đầu
TankView.tank_built                         # signal không tham số, phát sau mỗi lần dựng xong
```

`water_rect`, `fish_count` và `_on_scene_loaded(dto)` được giữ lại. Logic fish và Bridge
không đổi. `Glass/WaterTint` có ShaderMaterial với uniform `turbidity` (0..1, mặc định 0)
cho Phase 4. Các shader chỉ dùng canvas_item, chạy với GL Compatibility/WebGL 2.

`StyleLibrary.load_style(key)` đọc `data/styles/<key>.json`, merge đệ quy trên Nature;
key thiếu/không hợp lệ dùng Nature. Nature còn có fallback nhúng nếu JSON chưa tồn tại.
Style điều khiển tile, dốc nền 40→22px, màu nước/ánh sáng/phông/gỗ, các công tắc
`caustics`, `god_rays`, `bubbles`, `particles`, `sway` (0..2px), `current` (-1..1) và `turbidity`.

`LayoutSolver.solve(dto, style, water_rect, get_substrate_y)` trả danh sách prop.
Khi `scene.props` trống: seed từ `tank.id`, đá chính ở 0.382/0.618 chiều ngang,
đá phụ quanh nó; cây cao về sau, cây vừa quanh đá và cây thấp thành dải phía trước.
Nếu một trong hai danh sách `plants`/`hardscape` thiếu hoặc rỗng, dùng mặc định tương ứng
trong style. DTO mẫu có sẵn 1 đá + 2 Java fern nên giữ đúng số lượng này.
Toàn bộ prop tự xếp đặt chân tại `get_substrate_y(x) + 2`, lượng tử hóa theo pixel.

`scene.props` có phần tử thì danh sách đó là bố cục tác giả, không tự thêm prop.
Hỗ trợ `refType: plant|hardscape`, `refId` khớp `id`/`_id` trong danh sách DTO,
hoặc chỉ định trực tiếp `plantKey`/`spriteKey`/`key`; `layer` nhận
`background|midground|foreground`, `back|front` hoặc tên Node2D ở trên.
`x, y` là **tọa độ chân theo pixel thế giới**, `flip` lật quanh pivot.
Giữ nguyên tọa độ đã lưu để cây bám đá/lũa không bị kéo xuống nền; nếu bỏ `y`, solver
tự đặt chân xuống nền và chôn 2px. Ví dụ:

```json
{"refType":"plant", "plantKey":"anubias", "x":310, "y":279, "layer":"midground", "flip":false}
```

### Quy ước asset

| Loại | Đường dẫn | Kích thước chuẩn |
|---|---|---|
| Tile | `assets/tiles/sand_fine.png`, `gravel.png` | 16×16 seamless |
| Đá | `assets/hardscape/seiryu_l.png`, `seiryu_m.png`, `seiryu_s.png` | 96×64, 64×48, 32×24 |
| Lũa | `assets/hardscape/driftwood_branch.png` | 128×96 |
| Thảm/rêu | `assets/plants/carpet_grass.png`, `moss.png` | 64×16, 32×16 |
| Cây vừa | `assets/plants/anubias.png`, `java_fern.png` | 48×40, 48×64 |
| Cây cao | `assets/plants/rotala.png`, `vallisneria.png` | 32×96, 32×112 |

PNG cây/đá trong suốt, Nearest, không mipmap, không scale lẻ. Mặc định pivot giữa-đáy
theo kích thước ảnh thực. Metadata tùy chọn cùng tên **không có `.png`**:
`java_fern.json` chứa `{"pivot":{"x":24,"y":64},"anchor":"bottom"}`.
Pivot cụ thể được ưu tiên và snap pixel; lật vẫn giữ nguyên chân. Cây được thêm gutter
trong suốt 2px ở bộ nhớ để sway không cắt ngọn; không sửa PNG gốc.

`PropTextures.gd` tự dùng PNG khi tồn tại, còn thiếu file thì sinh texture thủ tục trong
bộ nhớ ở kích thước chuẩn với palette AquaVerse. Cát fallback #E8D9B5 + chấm #CDB98F;
mọi mép nền đều có hàng sáng #F4ECD6. Không cần bước tạo asset trước khi chạy.
Preset Web include JSON style/metadata và PNG; các file QA trong `build/` bị loại khỏi export.

### Kiểm tra môi trường

```powershell
$godot = 'D:/GoDot/Godot_v4.7-stable_win64.exe/Godot_v4.7-stable_win64_console.exe'
& $godot --headless --path game --import --quit
& $godot --headless --path game --script res://tests/EnvironmentSmoke.gd
New-Item -ItemType Directory -Force game/build | Out-Null
# Kiểm tra renderer thật, chụp 800×600, xác nhận màu viền và đo 150 frame sau warmup
& $godot --path game --script res://tests/EnvironmentSmoke.gd --disable-vsync -- --visual
# Movie PNG sequence (Godot cố định độ phân giải movie theo viewport khi khởi động)
& $godot --path game --write-movie res://build/nature.png --fixed-fps 60 --quit-after 150
```

Smoke test kiểm tra thứ tự lớp/API, seed ổn định, tọa độ tác giả, neo/chôn chân,
fallback cho cả 10 cây/đá, thiết bị, công tắc hiệu ứng và reload. `--visual` thêm ảnh
`build/t010-desktop-800x600.png`, `build/t010-defaults-800x600.png` và kiểm tra pixel màu viền.
Số liệu trong [T-010-report.md](T-010-report.md) là phép đo desktop uncapped, không phải Web.

## Cá sống động (T-012)

`Fish.tscn` dùng `FishBrain` (tọa độ/vận tốc float) và `fish_swim.gdshader`
(offset nguyên pixel, lật qua pivot, squash quay đầu). Thiếu PNG dùng lại
`PlaceholderFish` dưới cùng brain. `FishWorld` dựng spatial hash ô 32px mỗi frame,
luân phiên tính lực hàng xóm mỗi hai frame/cá; hai lớp cá giữ màu và thứ tự T-010.
`data/species_profiles.json` chứa mặc định; DTO `render` ghi đè, riêng `speed`
giữ hợp đồng hệ số nhân (profile lưu px/s). DTO mẫu đổi Thần tiên sang `hover`.

- **Cho ăn / F**: bật chế độ; click nước thả 6–10 viên rồi thoát chế độ, Esc hủy.
  Mỗi lượt gửi một `action:feed` với Unix timestamp giây; cá đáy chỉ ăn mồi trên nền.
- Click cá ưu tiên mở thẻ; hover viền 1px; double-click bám cá; Esc đóng và thôi bám.
  Nút **Xem chi tiết** gửi `open:species`. Cảnh báo dựa vào nhiệt độ/pH có trong DTO.
- Click nước trống gõ kính; kéo ≥4px pan bể dài, không gõ kính khi kết thúc kéo.
- Thêm `-- --demo-feed`: mồi frame 60, gõ kính 180, viền + thẻ frame 240.
  Thêm `--stress` để Bridge tải `sample_scene_stress.json` (100 Neon + 20 cá khác).
  Khi nhúng Web, DTO vẫn do trang cha cung cấp theo giao thức Bridge hiện có.

Chạy kiểm tra từ thư mục gốc (PowerShell, chỉ headless):

```powershell
$env:APPDATA = "$PWD/game/build/profile"
$env:LOCALAPPDATA = "$PWD/game/build/cache"
$godot = 'D:/GoDot/Godot_v4.7-stable_win64.exe/Godot_v4.7-stable_win64_console.exe'
& $godot --headless --path game --editor --import --quit
& $godot --headless --path game --script res://tests/FishLogic.gd
& $godot --headless --path game --script res://tests/FishIntegration.gd
& $godot --headless --path game --script res://tests/EnvironmentSmoke.gd
& $godot --headless --path game --script res://tests/FishBenchmark.gd
```

`FishLogic` so sánh hash với vét cạn cả tọa độ âm/mép ô và mô phỏng 120 cá × 2000
bước. `FishIntegration` kiểm tra mồi, sục đáy, tan sau 60s, flee, thẻ/camera/F/Esc,
fallback, reload 120 cá và demo. Benchmark lấy trung bình 600 frame sau 180 warmup,
đọc `Performance.TIME_PROCESS`, wall time và CPU riêng `FishWorld`. Headless không
đo GPU/present; cần reviewer xác nhận ≥60 FPS desktop và console Web.
