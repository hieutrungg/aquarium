# T-010 — Nature environment

Đã thêm 13 lớp vẽ, StyleLibrary/Nature JSON, LayoutSolver theo seed, texture fallback
cho toàn bộ cây/đá/tile, bốn canvas shader, bọt/hạt CPU, mặt nước/kính/phông/kệ/đèn,
HUD theme và viewport con để tô viền mint. Không sửa `scripts/fish/*`, Bridge,
frontend, backend, tools hoặc art. Các thay đổi asset đang xuất hiện trong workspace
là từ công việc song song; renderer tự nhận PNG/metadata khi có.

API, thứ tự lớp, tọa độ prop và quy ước asset được ghi trong [README](README.md#môi-trường-nature-t-010).
Tọa độ `scene.props.x/y` là chân theo pixel thế giới và được giữ nguyên; prop tự xếp
hoặc không có y đặt tại mặt nền +2px. Giữ y đã lưu cho phép cây bám đá/lũa.

## Đã kiểm chứng

- Godot **4.7.stable.official.5b4e0cb0f**, GL Compatibility, AMD Radeon 880M.
- Headless import và smoke test hoàn tất; không có lỗi/cảnh báo GDScript.
- Renderer desktop thật: smoke test qua thứ tự 13 lớp, API/signal, 29 cá,
  seed ổn định, fallback style, vị trí tác giả, neo chân, 10 fallback cây/đá,
  thiết bị/công tắc hiệu ứng và tải lại.
- Ảnh cửa sổ **800×600**: viewport 640×360 ở `(80,120)`;
  pixel kiểm tra ở cả bốn vùng viền đều đúng **#EAF6F2**.
- Kiểm tra một bản project tạm **không có thư mục assets/**: vẫn dựng đủ cảnh,
  test desktop và kiểm tra màu viền đều qua. Không di chuyển/xóa asset đang làm song song.
- `--write-movie ... --quit-after 150 --fixed-fps 60` ghi đủ **150 frame**;
  CPU render trung bình **0.04 ms/frame**, GPU render **0.09 ms/frame**.
  Movie maker chốt canvas đầu vào 640×360 trước `_ready`; ảnh 800×600 bên dưới
  được lấy trực tiếp từ Window sau resize và dùng cho kiểm tra letterbox.
- `--export-pack Web` thành công, chứa JSON style/metadata và shader.
- HUD detector không báo lỗi; đã xem ảnh desktop và ảnh toàn bộ fallback.

## Số node và thời gian frame

Đo **150 frame sau 30 frame warmup**, renderer desktop thật, cửa sổ 800×600,
`--disable-vsync`, không giới hạn FPS. Thời gian là wall time giữa các process frame,
bao gồm render/present; không tính import/startup và không tính ghi PNG/movie.

| Cảnh | Node toàn cây SceneTree | Node trong TankView (kể cả TankView) | Trung bình |
|---|---:|---:|---:|
| DTO mẫu: 29 cá, 1 đá, 2 fern | 90 | 79 | 2.119 ms/frame |
| Giữ 29 cá, dùng defaults cây/đá đầy đủ | 117 | 106 | 2.241 ms/frame |

Node toàn cây gồm Window, hai autoload, khung viewport và HUD. Tất cả 40 hạt và
18 bọt được vẽ trong một Node2D; không tăng node theo từng hạt. Số node tùy việc
PNG cá tồn tại (mỗi fish có thể tạo thêm Sprite2D); các số trên tính tại snapshot QA.
Đây không phải số đo hiệu năng Web và không bảo đảm FPS trên máy khác.

## Giới hạn môi trường QA

- Sandbox không đọc được Windows root certificate store; Godot in
  `Failed to read the root certificate store` ngay lúc khởi động, kể cả import.
  Đây là lỗi môi trường; không tắt TLS hoặc sửa cấu hình chứng chỉ để giấu lỗi.
  APPDATA/LOCALAPPDATA của các lần QA trỏ vào `game/build/` để tránh lỗi ghi profile.
- **Chưa xác nhận Chrome/console Web.** Browser access host không khả dụng;
  Computer Use cũng từ chối quyền truy cập Chrome. Không thử đi vòng quyền này.
- `--export-release Web` còn bị chặn do thiếu `web_nothreads_debug.zip` và
  `web_nothreads_release.zip` trong profile sandbox. Thư mục templates của user
  không có quyền đọc. Cần chạy lại với Web export templates 4.7.stable ở máy reviewer.
  Đã tạo PCK mới và ghép bản engine Web có sẵn trong repo vào `build/web/` để reviewer
  có thể phục vụ HTTP kiểm tra; không sửa các file engine ở frontend.

## Artifact QA (gitignored)

- [DTO mẫu 800×600](build/t010-desktop-800x600.png)
- [Defaults 800×600](build/t010-defaults-800x600.png)
- [Toàn bộ fallback 800×600](build/t010-fallback/build/t010-defaults-800x600.png)
- Movie: `build/nature00000000.png` … `build/nature00000149.png`.
- Log import/headless/movie: `build/t010-*.log`.
- Test có thể chạy lại: [tests/EnvironmentSmoke.gd](tests/EnvironmentSmoke.gd).
