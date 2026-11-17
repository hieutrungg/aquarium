# 🐠 AquaVerse — Kế hoạch dựng Bể cá 2D Pixel Art tương tác

> Mục tiêu: biến dữ liệu bể người dùng đã nhập (kích thước, kiểu bể, cá, cây, hardscape, thông số nước, lịch chăm sóc) thành **một bể cá 2D pixel art sống động, tương tác được**, phong cách **Cozy + Nature + Soft Pastel**.
>
> Ngày lập: 2026-11-17 · Trạng thái: **Kế hoạch v1 — chưa bắt đầu code**

---

## 0. Tóm tắt quyết định

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Engine | **Godot 4.7** (`D:\GoDot\Godot_v4.7-stable_win64.exe`), **GDScript**, renderer **GL Compatibility** | Web export chỉ chạy với Compatibility; C# không export được lên Web. Export templates 4.7.stable đã cài sẵn. |
| Cách nhúng vào web hiện tại | Godot **Web export (single-thread)** → `frontend/public/aquarium/`, React nhúng qua `<iframe>` ở route mới `/tanks/:id/aquarium` | Không cần header COOP/COEP; React giữ auth + API, Godot chỉ lo render. |
| Giao tiếp | `postMessage` 2 chiều (React ⇄ Godot `JavaScriptBridge`) | Godot không cần biết JWT; dễ test offline bằng JSON mẫu. |
| Độ phân giải gốc | **640×360**, stretch `viewport`, **integer scaling** | Pixel không bị méo; 2× = 1280×720, 3× = 1920×1080. |
| Canvas sprite cá | **64×64** chuẩn, **96×96** cho cá lớn/vây phức tạp | Theo bảng đánh giá kích thước. |
| Animation cá | **Sprite tĩnh + shader bơi** (uốn thân/đuôi theo sin, lượng tử hoá theo pixel) + 2–4 frame phụ trong Aseprite cho loài vây lớn | AI rất khó vẽ nhiều frame nhất quán; shader cho chuyển động mượt, rẻ, đồng bộ mọi loài. |
| Sinh asset | **Antigravity CLI (`agy`)** sinh ảnh thô → script Node chuẩn hoá lưới pixel → **Aseprite CLI** ép palette, dọn, xuất sheet | Không có Python trên máy → tool dùng Node (v25 có sẵn). |
| Code logic | **Codex CLI** (`codex exec`) theo từng task brief | Claude lập kế hoạch, viết brief, review, chạy kiểm thử. |
| Repo | **`git init` trước khi giao việc cho agent** | Codex cần git để review diff/rollback; hiện thư mục chưa phải git repo. |

---

## 1. Hiện trạng dự án

- `backend/` Express + Mongoose: `Tank` (dimensions, volume, type `planted|freshwater|saltwater`, equipment), `Livestock`, `TankPlant`, `Hardscape`, `WaterLog`, `CareTask`, `Species`, `Plant`, `utils/layout.js` (đề xuất style theo rule), `utils/gemini.js` (sinh ảnh minh hoạ).
- `frontend/` React + Vite + Tailwind: `TankDetail.jsx` (697 dòng) quản lý bể dạng form/bảng, **chưa có giao diện bể trực quan**.
- Thiếu: trường `style` cho bể, thông tin hiển thị cho loài (sprite, tầng bơi, hành vi), vị trí bố cục cây/đá.

---

## 2. Vai trò & quy trình điều phối agent

```
 Người dùng ──yêu cầu──► Claude (lập kế hoạch, viết brief, review, nghiệm thu)
                              │                                  ▲
                 brief asset  │                       brief code │  diff + log
                              ▼                                  │
                   agy (Antigravity) ── ảnh thô ──► tools/ (Node + Aseprite) ──► art/export
                                                                 │
                   codex exec ── GDScript / shader / API / React ┘
```

### 2.1 Claude (người kiểm soát)
- Chia việc thành task nhỏ có **tiêu chí nghiệm thu đo được**, lưu ở `docs/tasks/T-xxx.md` (code) và `docs/tasks/A-xxx.md` (asset).
- Sau mỗi task: đọc diff, chạy Godot headless, chạy QA sprite, chụp ảnh preview, rồi **chấp nhận / trả lại kèm ghi chú**.
- Mỗi task một commit; không gộp nhiều task vào một lần chạy agent.

### 2.2 Lệnh chuẩn

**Codex (code):**
```bash
codex exec -C D:/DuAnLinhTinh/Aquarium -s workspace-write -o docs/tasks/out/T-001.md - < docs/tasks/T-001.md
```

**Antigravity (asset):** (Phase 0 phải xác nhận agy có tool sinh ảnh và lưu được file PNG)
```bash
agy -p "$(cat docs/tasks/A-001.md)" --mode accept-edits --model gemini-3.8-flash-high --print-timeout 15m
```

**Aseprite (hậu kỳ):**
```bash
"D:/Avatar/asesprite/aseprite.exe" -b art/raw/neon_tetra.png --script-param palette=art/palette/aquaverse.gpl --script-param out=art/source/fish/neon_tetra.aseprite --script tools/aseprite/normalize.lua
```

**Godot (kiểm tra & export):**
```bash
"D:/GoDot/Godot_v4.7-stable_win64.exe" --headless --path game --import --quit
```
```bash
"D:/GoDot/Godot_v4.7-stable_win64.exe" --headless --path game --export-release "Web" ../frontend/public/aquarium/index.html
```

### 2.3 Mẫu brief task (Codex)
```
# T-0xx: <tên>
Bối cảnh: <1–3 câu, file liên quan>
Việc cần làm: <gạch đầu dòng cụ thể>
Không được làm: <phạm vi cấm, vd. không sửa art/, không đổi API khác>
Hợp đồng dữ liệu: <link mục 6 của plan.md>
Nghiệm thu: <lệnh chạy + kết quả mong đợi>
```

---

## 3. Định hướng hình ảnh — Cozy + Nature + Soft Pastel

### 3.1 Bảng màu cốt lõi (bắt buộc)

| Thành phần | Mã màu | Dùng ở |
|---|---|---|
| Nền tổng thể game | `#EAF6F2` | Viền ngoài viewport, nền trang chứa iframe |
| Nước bể cá | `#B8E1D5` | Khối nước chính |
| Background phía sau bể | `#76B5A5` | Tường/phông phía sau kính bể |
| Nền menu & cửa hàng | `#F9F5E9` | Panel HUD, drawer cửa hàng, tooltip |
| Text, icon | `#35574F` | Chữ, icon, viền panel |
| Accent (nút quan trọng) | `#F2B77E` | Nút Cho ăn, Lưu, Mua |

### 3.2 Palette mở rộng (v0 — chốt lại sau pilot Phase 0)
Tất cả sprite **chỉ được dùng màu trong `art/palette/aquaverse.gpl`** (khoảng 48 màu). Gồm các ramp:

| Ramp | Màu (tối → sáng) |
|---|---|
| Nước | `#5E9E8E` `#76B5A5` `#8FC9BA` `#B8E1D5` `#D6F0E8` |
| Rêu / lá | `#3F6B4A` `#5E8C61` `#7FA86A` `#A8C686` `#CFE3A8` |
| Cát / nền | `#9C8463` `#CDB98F` `#E8D9B5` `#F4ECD6` |
| Đá | `#4F5B55` `#6E7D74` `#9AA59B` `#C3CBC1` |
| Lũa / gỗ | `#4A3A2E` `#6B5241` `#8B6B4E` `#B08E6E` |
| Kem / UI | `#35574F` `#F9F5E9` `#FFFDF6` `#F2B77E` `#E39A5C` |
| Màu cá (bão hoà hơn để nổi trên nền pastel) | xanh neon `#3FB8E8` `#7FE0FF`, đỏ `#D9534F` `#F07C6C`, cam `#F29A4A`, vàng `#F5D06B`, tím `#9B7FD1`, hồng `#F2A7C3`, đen mềm `#2B3433`, trắng `#FFFFFF` |

Nguyên tắc: **nền pastel, cá là điểm nhấn** — cá được phép dùng màu bão hoà; cây/đá/nước giữ độ bão hoà thấp. Không dùng đen tuyệt đối `#000000`.

### 3.3 Quy tắc pixel art chung
- Ánh sáng từ **trên-trái**, đổ bóng xuống dưới-phải.
- Không anti-aliasing, không gradient mượt, alpha chỉ 0 hoặc 255 (trừ hiệu ứng shader).
- Viền chọn lọc (selective outline) màu tối của chính ramp, không viền đen.
- Mọi cá **nhìn ngang, quay sang phải**; flip trái bằng `flip_h`.
- Chiều sâu bể thể hiện bằng **lớp + pha màu nước** (cá ở xa ám `#8FC9BA` 25–35%), **không scale lẻ** (scale lẻ phá lưới pixel).

### 3.4 UI
- Font pixel **phải hỗ trợ tiếng Việt đầy đủ dấu**. Phase 0 test chuỗi: `Cá Thần Tiên Ai Cập — Bống suối ữ ỗ ặ ẫ ỷ`. Ứng viên: Fusion Pixel, Ark Pixel, Silver (kiểm tra license & độ phủ glyph).
- Panel 9-slice nền `#F9F5E9`, viền `#35574F` bo góc 2px, đổ bóng 1px `#76B5A5`.
- Phía React: đưa 6 màu cốt lõi vào `tailwind.config.js` (`aqua.bg`, `aqua.water`, `aqua.wall`, `aqua.cream`, `aqua.ink`, `aqua.accent`) để trang quản lý đồng bộ với game.

---

## 4. Bảy phong cách bể → template cảnh

Mỗi style là một file `game/data/styles/<key>.json` quy định: khung bể, nền, phông, bộ cây/đá cho phép, mật độ, độ đục, ánh sáng, dòng chảy, mặt nước, hạt bay.

| Key | Phong cách | Kích thước mặc định (D×R×C cm) | Thể tích | Đặc trưng hình ảnh khi render | Cá gợi ý |
|---|---|---|---|---|---|
| `nature` / `iwagumi` | Nature & Iwagumi | 60×30×36 (std), 90×45×45 (md) | 60–180 L | Không gian mở, thảm cỏ tiền cảnh, đá theo số lẻ (Iwagumi) hoặc lũa+đá (Nature); 3 lớp parallax tạo chiều sâu; tia sáng nhẹ | Neon xanh, Neon vua, Sóc đầu đỏ, Tam giác, Hồng nhung, Chim cánh cụt |
| `dutch` | Hà Lan | 90×45×45 → 120×50×50 | 180–300 L | **Không đá/lũa**, các luống cây nhiều màu xếp tầng (đỏ/xanh/vàng), đường đi "street" chéo; tương phản mạnh | Cầu vồng, Sặc gấm, Phượng hoàng, Thần tiên, Đĩa |
| `biotope_amazon` | Biotope Nam Mỹ | 80×40×40 → 120×45×45 | 120–240 L | **Nước đen** (overlay trà `#C9A46A` 20%), lá bàng rụng, rễ cây, cát mịn, ánh sáng loang lổ | Corydoras, Bút chì, Thần tiên Ai Cập |
| `biotope_asia` | Biotope châu Á | như trên | 120–240 L | Suối rừng, lá khô, rễ, nước trong ám vàng nhẹ | Bảy màu rừng, Cờ, Mún |
| `stream` | Hệ suối | 80×35×35, 100×40×40 | 90–160 L | Bể **dài & thấp**, đá cuội lớn, **dòng chảy** trái→phải (hạt bọt trôi ngang, cây nghiêng), bọt khí nhiều | Sọc ngựa, Bống suối, Tỳ bà bướm, Chạch suối, Trâm |
| `paludarium` | Bán cạn | 45×30×45, 60×40×60 | 15–40 L (nước) | Nước chỉ chiếm **1/3 dưới**; trên là vách đá, rêu, cây trên cạn, **thác nước** (sprite động 4–6 frame), hơi sương | Guppy, Sóc đầu đỏ, Molly, Mún |
| `balcony_jar` / `foam_box` | Chum ban công & Thùng xốp | Ø40–60 cm / 60×45×40 | 30–70 L | **Mặt cắt chum gốm** hoặc thùng xốp; nền ban công ngoài trời, bầu trời theo giờ thực, **mưa/nắng**, bèo & súng trên mặt, không có lọc → ít bọt | Bảy màu, Betta, Ba đuôi, Thiên đường, Đuôi kiếm |
| `lowtech` | Low-tech (không CO2) | 30×20×25 (nano) → 60×30×36 | 15–65 L | Ánh sáng dịu, ráy/dương xỉ bám lũa, rong, bèo; hơi "hoang" ấm cúng | Otto, Bống vàng, Tỳ bà mini, Cánh buồm, Tứ vân |

**Ánh xạ kích thước bể → cảnh:**
- Chiều cao cảnh cố định 300px trong viewport 640×360 (chừa HUD). Chiều rộng cảnh = `300 × Dài / Cao`, clamp 400–1200px. Nếu rộng hơn viewport → camera **kéo ngang** (drag / phím ←→).
- Chiều **Rộng** (sâu) quyết định số lớp parallax: < 35 cm → 2 lớp, 35–45 → 3 lớp, > 45 → 4 lớp.
- Chum tròn: dùng mặt nạ (mask) hình chum, không theo công thức chữ nhật.

---

## 5. Thiết kế sprite cá

### 5.1 Quy chuẩn chung
- Canvas **64×64** (mặc định) hoặc **96×96** (cá lớn). Cá **không cần chiếm hết canvas**; chừa ≥ 4px padding quanh vây.
- **Tỷ lệ giữa các loài là "cách điệu có kiểm soát"**, không theo cm thật (nếu theo cm thì Neon chỉ còn 5px trong bể 120cm). Dùng bảng chiều dài thân (px) ở 5.3 làm chuẩn.
- **Điểm neo (pivot)** = tâm thân (không phải tâm canvas) → ghi trong metadata để cá quay đầu không bị giật.
- Mỗi loài xuất: `fish_<key>.png` (sprite gốc), `fish_<key>_mask.png` (vùng uốn: thân/đuôi/vây — dùng cho shader), tuỳ chọn `fish_<key>_fins.png` (2–4 frame vây phấp phới), `fish_<key>.json` (pivot, chiều dài, vùng miệng).
- Các biến thể giới tính/màu (Guppy, Betta, Mún, Molly): **cùng hình, đổi palette** bằng palette-swap shader → tiết kiệm asset.

### 5.2 Kiểm thử bắt buộc cho mỗi sprite (QA tự động + Claude review)
1. **Palette test** — mọi pixel thuộc `aquaverse.gpl`, ≤ 16 màu/sprite.
2. **Alpha test** — chỉ alpha 0/255, nền trong suốt, không viền mờ.
3. **Silhouette test** — tô đen toàn bộ: vẫn nhận ra loài, phân biệt được với các loài cùng nhóm (Betta ≠ Guppy ≠ Neon).
4. **Thumbnail test** — xem ở 1× trên nền `#B8E1D5`: đặc điểm nhận dạng còn thấy (vd. 2 sọc Neon).
5. **Hướng & khung** — quay phải, căn giữa, padding ≥ 4px, không chữ/không nền/không bóng đổ ngoài.
6. **Bảng so sánh** — đặt cạnh nhau tất cả cá đã duyệt để kiểm tra tỷ lệ tương đối.

### 5.3 Danh mục loài & thông số sprite

`Tầng`: T = tầng mặt, G = tầng giữa, Đ = tầng đáy. `Ưu tiên`: P1 = vertical slice, P2 = mở rộng, P3 = sau.

| Key | Tên Việt | Tên khoa học | Canvas | Kích thước cá (px) | Tầng | Hành vi | Style | Ưu tiên |
|---|---|---|---|---|---|---|---|---|
| `neon_tetra` | Neon xanh | *Paracheirodon innesi* | 64 | dài 38 | G | đàn chặt | nature | **P1** |
| `betta` | Betta (Xiêm) | *Betta splendens* | 64 | dài 50, cao 44 (vây) | T–G | đơn độc, lãnh thổ, bơi chậm | jar | **P1** |
| `angelfish` | Thần tiên | *Pterophyllum scalare* | 64 | dài 34, cao 55 | G | lượn chậm, theo cặp | dutch | **P1** |
| `guppy` | Bảy màu | *Poecilia reticulata* | 64 | dài 36 (đuôi 14) | T–G | nhóm lỏng, đực khoe đuôi | jar, palu | **P1** |
| `panda_cory` | Chuột Panda | *Corydoras panda* | 64 | dài 34 | Đ | đàn nhỏ, sục đáy, thỉnh thoảng lao lên lấy khí | biotope | **P1** |
| `cardinal_tetra` | Neon vua | *P. axelrodi* | 64 | dài 40 | G | đàn chặt | nature | P2 |
| `rummynose` | Sóc đầu đỏ | *Hemigrammus rhodostomus* | 64 | dài 40 | G | đàn rất chặt, đồng bộ | nature, palu | P2 |
| `harlequin` | Tam giác | *Trigonostigma heteromorpha* | 64 | dài 38 | G | đàn | nature | P2 |
| `serpae` | Hồng nhung | *Hyphessobrycon eques* | 64 | dài 38, cao 22 | G | đàn, hơi nghịch | nature | P2 |
| `penguin_tetra` | Chim cánh cụt | *Thayeria boehlkei* | 64 | dài 40 | G | đàn, bơi **chúc đầu lên** ~15° | nature | P2 |
| `rainbowfish` | Cầu vồng | *Melanotaenia boesemani* | 64 | dài 54 | G | đàn lỏng, bơi nhanh | dutch | P2 |
| `dwarf_gourami` | Sặc gấm | *Trichogaster lalius* | 64 | dài 44 | T–G | chậm, râu bụng dò đường | dutch | P2 |
| `ram` | Phượng hoàng | *Mikrogeophagus ramirezi* | 64 | dài 40 | Đ–G | theo cặp, giữ lãnh thổ nhỏ | dutch | P2 |
| `discus` | Đĩa | *Symphysodon* sp. | **96** | đường kính 68 | G | chậm, đàn nhỏ | dutch | P3 |
| `pencilfish` | Bút chì | *Nannostomus beckfordi* | 64 | dài 36 | T–G | đàn lỏng, lơ lửng | biotope_amazon | P2 |
| `altum_angel` | Thần tiên Ai Cập | *Pterophyllum altum* | **96** | dài 44, cao 80 | G | lượn rất chậm | biotope_amazon | P3 |
| `endler` | Bảy màu rừng | *Poecilia wingei* | 64 | dài 30 | T–G | nhóm, rất linh hoạt | biotope_asia | P3 |
| `paradise_fish` | Cờ / Thiên đường | *Macropodus opercularis* | 64 | dài 52 | T–G | lãnh thổ, lên mặt đớp khí | biotope_asia, jar | P2 |
| `platy` | Mún | *Xiphophorus maculatus* | 64 | dài 40 | G | nhóm, hiền | biotope_asia, palu | P2 |
| `zebra_danio` | Sọc ngựa | *Danio rerio* | 64 | dài 42 | T–G | đàn, **rất nhanh**, thích dòng chảy | stream | P2 |
| `stream_goby` | Bống suối | *Rhinogobius* sp. | 64 | dài 40 | Đ | đậu trên đá, nhảy từng quãng | stream | P3 |
| `hillstream_loach` | Tỳ bà bướm | *Sewellia lineolata* | 64 | dài 44 (dẹt) | Đ | **bám đá/kính**, trượt | stream | P3 |
| `stream_loach` | Chạch suối | *Schistura* sp. | 64 | dài 50 | Đ | chui khe đá | stream | P3 |
| `white_cloud` | Trâm* | *Tanichthys albonubes* | 64 | dài 36 | G | đàn, chịu lạnh | stream | P3 |
| `molly` | Bình tích | *Poecilia sphenops* | 64 | dài 46 | G | nhóm, rỉa rêu | palu | P2 |
| `fancy_goldfish` | Ba đuôi | *Carassius auratus* (fancy) | **96** | dài 64 (đuôi 24) | G | chậm, lạch bạch, rỉa đáy | jar | P2 |
| `swordtail` | Đuôi kiếm | *Xiphophorus hellerii* | 64 | dài 54 (kiếm 14) | G | nhóm, đực rượt nhau | jar | P3 |
| `otocinclus` | Otto | *Otocinclus* sp. | 64 | dài 34 | Đ + kính | **bám kính/lá** rỉa rêu | lowtech | P2 |
| `bumblebee_goby` | Bống vàng | *Brachygobius* sp. | 64 | dài 28 | Đ | đậu, lãnh thổ nhỏ | lowtech | P3 |
| `bristlenose` | Tỳ bà mini | *Ancistrus* sp. | 64 | dài 48 | Đ + kính | bám, hoạt động ban đêm | lowtech | P2 |
| `black_skirt` | Cánh buồm | *Gymnocorymbus ternetzi* | 64 | dài 40, cao 38 | G | đàn | lowtech | P3 |
| `tiger_barb` | Tứ vân | *Puntigrus tetrazona* | 64 | dài 42 | G | đàn, **cắn vây** (cảnh báo khi nuôi chung Betta/Thần tiên) | lowtech | P2 |

\* "Cá Trâm" cần người dùng xác nhận đúng loài trước khi vẽ.

### 5.4 Thẻ đặc điểm nhận dạng (những thứ **phải giữ** kể cả ở 1×)

| Loài | Silhouette | Đặc điểm bắt buộc | Phân biệt với |
|---|---|---|---|
| **Neon xanh** | Nhỏ, thon dài, đuôi chẻ | Sọc **xanh phát sáng** từ mắt tới gốc đuôi (2px cao, có 1 pixel highlight) + **đỏ chỉ nửa thân sau dưới**; vây trong suốt (1–2 pixel nhạt) | Neon vua: đỏ **kéo dài cả bụng** |
| **Betta** | Thân ngắn, **vây + đuôi cực lớn xoè mềm** chiếm ~60% diện tích | Đuôi xoè rủ xuống, vây lưng & hậu môn dài liền khối; miệng hếch | Guppy: Betta có vây **trên/dưới cũng to**, đuôi rủ; Guppy chỉ đuôi to, vây lưng nhỏ |
| **Thần tiên** | Thân **dẹt, cao, tam giác**; vây lưng & hậu môn **rất dài** kéo về sau | 3–4 sọc đen dọc thân; 2 sợi vây bụng dài như râu | Altum: cao hơn nữa, có "bậc" ở trán |
| **Guppy** | Thân nhỏ, **đuôi hình quạt lớn** (~40% chiều dài), nhiều hoa văn | Đuôi quạt rộng & phẳng, vây lưng nhỏ; hoa văn chấm/da báo trên đuôi | Betta (xem trên); Endler: đuôi nhỏ hơn, thân có mảng cam/đen |
| **Chuột Panda** | Thân **mập, gần đáy, bụng phẳng**, đầu tù | **Mảng đen quanh mắt** (như gấu trúc), đốm đen ở gốc vây lưng và gốc đuôi; **râu ngắn** 1–2px dưới miệng | Otto: thon hơn, sọc ngang tối |
| Sóc đầu đỏ | Thon, đuôi chẻ | Đầu đỏ, đuôi **sọc ngựa đen-trắng** | — |
| Tam giác | Thân cao vừa | **Mảng đen tam giác** nửa sau thân | Tứ vân (4 sọc dọc) |
| Chim cánh cụt | Thon | Sọc đen chạy **từ thân xuống thuỳ đuôi dưới**, tư thế chúc đầu lên | — |
| Đĩa | Gần như **tròn** | Sọc dọc mảnh, viền vây đỏ/cam | — |
| Sặc gấm | Bầu dục | Sọc chéo đỏ-xanh xen kẽ, **râu bụng dài** | — |
| Tỳ bà bướm | **Dẹt, vây ngực xoè như cánh** | Vằn hoa văn kiểu báo | Chạch suối (thon dài) |
| Ba đuôi | Thân tròn, **đuôi đôi xoè** | Cam/trắng, bụng phệ | — |
| Đuôi kiếm | Thon | **Thuỳ đuôi dưới kéo dài thành kiếm** (con đực) | Mún (không kiếm, thân tròn hơn) |
| Tứ vân | Thân cao vừa | **4 sọc đen dọc**, mõm & vây đỏ | Tam giác |

### 5.5 Prompt mẫu (template)

**Prompt sprite cá** — phát triển từ prompt mẫu của bạn, thêm palette & tỷ lệ:
```
Create a game-ready 2D pixel art sprite of a {COMMON_NAME} ({SCIENTIFIC_NAME}).
Accurate biological morphology: {MORPHOLOGY}.
Key identifying features that MUST stay readable at 1x scale: {KEY_FEATURES}.
Strict side profile facing right, consistent orthographic view, light from the top-left,
crisp hand-placed pixels, selective darker outline (no black outline), limited palette of at most 16 colors
chosen from: {PALETTE_HEX_LIST}.
No anti-aliasing, no smooth gradients, no semi-transparent pixels, transparent background.
Single fish, the fish body is about {BODY_PX} pixels long, centered within a {CANVAS}x{CANVAS} pixel canvas,
leave at least 4 pixels of padding around the fins.
Render the image at {CANVAS*16}x{CANVAS*16} where every logical pixel is an exact 16x16 block on a perfect grid.
Preserve the distinctive appearance of the real species.
No text, no decorations, no aquarium background, no shadow, no water.
Intended for a cozy soft-pastel 2D pixel art aquarium simulation game.
```
> Yêu cầu "mỗi pixel = khối 16×16 trên lưới chuẩn" giúp script chuẩn hoá lấy mẫu chính xác về 64×64.

**Ví dụ điền sẵn — Chuột Panda:**
`{MORPHOLOGY}` = "short stocky body, flat belly resting near the substrate, blunt rounded head, high triangular dorsal fin, armored bony plates along the flank"
`{KEY_FEATURES}` = "black mask patch around the eye like a panda, black spot at dorsal fin base, black spot at tail base, two short barbels under the mouth, pale cream-pink body"
`{BODY_PX}` = 34 · `{CANVAS}` = 64

**Prompt mặt nạ uốn (mask) — làm bằng script, không cần AI:** script Node gán vùng theo trục X (0% mõm → 100% đuôi) và vùng vây theo màu → xuất `_mask.png` kênh R = trọng số uốn.

---

## 6. Tileset & asset môi trường

| Nhóm | Asset | Kích thước | Ghi chú |
|---|---|---|---|
| Nền (substrate) | Cát mịn, sỏi suối, nền phân đen, cát trắng Iwagumi, đá cuội | Tile **16×16** seamless + tile mép trên 16×8 | Autotile Godot TileMapLayer (terrain) để tạo dốc phía sau cao, phía trước thấp |
| Hardscape | Đá Seiryu (3 cỡ), đá cuội suối (4), lũa nhánh (3), lũa rễ (2), vách đá paludarium, hang | 32–128px, neo đáy | Có biến thể "phủ rêu" |
| Cây tiền cảnh | Cỏ thảm (Monte Carlo/HC), ngưu mao chiên, rêu | 16–32px, dạng dải lặp | Shader sway biên độ nhỏ |
| Cây trung cảnh | Ráy (Anubias), dương xỉ (Java fern), Bucephalandra, Cryptocoryne | 32–64px | Bám lũa/đá |
| Cây hậu cảnh | Rotala (đỏ/xanh), Ludwigia, Vallisneria, Rong đuôi chó, Hygrophila | 32×96px | Sway mạnh hơn, nhiều cành tách lớp |
| Cây nổi | Bèo tấm, bèo Nhật, súng, lá bàng khô | 8–48px | Trôi chậm trên mặt nước |
| Cây trên cạn (palu) | Rêu, dương xỉ, cây trầu bà nhỏ, Pothos rủ | 32–64px | |
| Khung bể | Bể kính viền mảnh (nature/dutch/stream/lowtech), mặt cắt chum gốm, thùng xốp, paludarium cao | 9-slice | Có lớp phản chiếu kính |
| Phông | Tường phòng `#76B5A5` + kệ gỗ/đèn treo; ban công + bầu trời (sáng/chiều/tối/mưa) cho chum | 640×360, 2–4 lớp parallax | |
| Thiết bị | Đèn treo, ống lọc, đầu sủi, ống CO2, sưởi | 16–48px | Hiện theo `tank.equipment` |
| Hiệu ứng | Bọt khí (4 cỡ), thức ăn viên/mảnh/đông lạnh, hạt lơ lửng, rêu kính, lá rụng, giọt mưa, thác nước (6 frame) | 2–16px | |
| UI | Panel 9-slice, nút (thường/hover/nhấn/accent), icon (cho ăn, đèn, chụp ảnh, sửa bố cục, cửa hàng, thông số, cảnh báo), con trỏ | 16×16 icon | Màu `#35574F` trên `#F9F5E9` |

**Prompt mẫu tileset nền:**
```
Create a seamless tileable 2D pixel art texture tile of {MATERIAL} aquarium substrate for a side-view aquarium game.
Exactly 16x16 logical pixels, rendered at 256x256 with each logical pixel as an exact 16x16 block.
Must tile seamlessly on all four edges. Light from the top-left. Use only these colors: {PALETTE_HEX_LIST}.
No anti-aliasing, no gradients, no text. Soft pastel cozy nature style.
```

**Prompt mẫu cây/đá:**
```
Create a game-ready 2D pixel art sprite of {PLANT_OR_ROCK} for a side-view aquarium, {W}x{H} pixel canvas,
anchored at the bottom center (base touches the bottom edge), transparent background,
light from the top-left, at most 12 colors from: {PALETTE_HEX_LIST}.
No anti-aliasing, no gradients, no water, no fish, no text. Cozy soft-pastel nature style.
```

---

## 7. Pipeline asset (agy → Node → Aseprite → Godot)

```
art/prompts/<batch>.md ──agy──► art/raw/<key>.png (≈1024px)
        └─► tools/sprite-normalize (Node, pngjs)
              • phát hiện lưới pixel, lấy mẫu màu đa số mỗi ô → 64×64 / 96×96
              • ngưỡng alpha (≥128 → 255, còn lại 0), cắt nền
        └─► Aseprite -b --script tools/aseprite/normalize.lua
              • ép về palette aquaverse.gpl (nearest), căn giữa canvas, padding
              • lưu art/source/<key>.aseprite (để chỉnh tay khi cần)
        └─► tools/sprite-qa (Node): palette/alpha/padding/số màu → báo cáo JSON + ảnh contact sheet
        └─► Claude review contact sheet (silhouette + thumbnail) → duyệt / yêu cầu sinh lại
        └─► Aseprite -b --sheet → art/export/<group>/*.png + .json
        └─► tools/sync-assets: copy vào game/assets/ (Godot import filter = Nearest, mipmaps off)
```

- Một loài tối đa **3 lần sinh lại**; sau đó Claude chỉ ra lỗi cụ thể để chỉnh tay trong Aseprite (file `.aseprite` được giữ lại).
- `art/raw/` không commit (gitignore); `art/source/` và `art/export/` có commit.

---

## 8. Kiến trúc Godot (`game/`)

```
game/
├── project.godot                 # 640x360, Compatibility, stretch=viewport, integer scale, texture filter Nearest
├── assets/                       # đồng bộ từ art/export
├── data/
│   ├── species_profiles.json     # thông số hiển thị & hành vi mỗi loài (mục 9.2)
│   ├── styles/*.json             # 7+ template phong cách
│   └── dev/sample_scene_*.json   # dữ liệu mẫu để chạy offline trong editor
├── shaders/
│   ├── fish_swim.gdshader        # uốn thân theo mask, lượng tử hoá theo pixel
│   ├── plant_sway.gdshader       # đung đưa theo chiều cao + hướng dòng chảy
│   ├── caustics.gdshader         # vân sáng đáy bể (2 lớp noise, lượng tử hoá màu)
│   ├── god_rays.gdshader         # tia sáng từ đèn
│   ├── water_tint.gdshader       # độ đục / ám rêu / nước đen theo chất lượng nước
│   └── palette_swap.gdshader     # biến thể màu Guppy/Betta/Mún...
├── scenes/
│   ├── main.tscn                 # root: Bridge + TankView + HUD
│   ├── tank/tank_view.tscn       # dựng lớp: phông, nước, hardscape, cây, cá, hiệu ứng, kính
│   ├── fish/fish.tscn            # Sprite2D + shader + FishBrain
│   ├── props/                    # plant.tscn, rock.tscn, bubble_emitter.tscn, food.tscn
│   └── ui/                       # hud.tscn, info_card.tscn, shop_drawer.tscn, edit_toolbar.tscn
└── scripts/
    ├── autoload/Bridge.gd        # JavaScriptBridge ⇄ postMessage; fallback đọc dev json
    ├── autoload/SceneState.gd    # trạng thái cảnh hiện tại (từ TankScene DTO)
    ├── tank/TankBuilder.gd       # DTO + style → dựng node
    ├── tank/LayoutSolver.gd      # tự xếp cây/đá khi chưa có toạ độ (quy tắc 1/3, cao sau thấp trước)
    ├── fish/FishBrain.gd         # state machine: wander / school / forage / rest / flee / eat / glass_cling / surface_gulp
    ├── fish/Boids.gd             # đàn (spatial hash, chỉ tính hàng xóm gần)
    ├── fish/SwimZones.gd         # tầng T/G/Đ theo chiều cao nước thực
    ├── fx/WaterQualityFx.gd      # map thông số nước → shader
    └── fx/DayNight.gd            # giờ thực / lịch đèn → ánh sáng
```

### 8.1 Thứ tự lớp vẽ (sau → trước)
1. Nền tổng thể `#EAF6F2` → 2. Tường/phông `#76B5A5` (parallax) → 3. Khối nước `#B8E1D5` + tia sáng → 4. Cây/đá hậu cảnh → 5. **Cá lớp xa** (ám màu nước) → 6. Cây/đá trung cảnh → 7. **Cá lớp gần** → 8. Nền substrate + caustics → 9. Cây tiền cảnh, thảm → 10. Bọt, hạt, thức ăn → 11. Mặt nước & cây nổi → 12. Kính (phản chiếu, rêu kính) + khung → 13. HUD.

### 8.2 Hiệu ứng "sống động như thật"
- **Cá**: tăng tốc/giảm tốc theo đường cong (không đều), thân uốn mạnh hơn khi rẽ/tăng tốc, quay đầu = squash 2 frame + flip, vây ngực rung khi đứng yên, đàn tách/nhập tự nhiên, cá đáy dừng-sục-dừng, Corydoras thi thoảng lao lên mặt đớp khí, Otto/Tỳ bà bám kính.
- **Nước**: caustics chuyển động trên đáy & cá gần đáy, tia sáng dao động chậm, hạt lơ lửng trôi, mặt nước gợn (vertex sin) + phản chiếu mờ.
- **Cây**: sway theo chiều cao, lệch theo dòng chảy của style (stream mạnh), cây bị cá chạm thì nghiêng nhẹ.
- **Bọt**: từ đầu sủi/lọc, lắc ngang khi lên, vỡ ở mặt nước (3 frame).
- **Thời gian thực**: sáng/chiều/tối theo giờ máy hoặc lịch đèn; ban đêm cá ngày chậm lại, Tỳ bà hoạt động nhiều hơn.

---

## 9. Hợp đồng dữ liệu & thay đổi backend

### 9.1 Thay đổi model
- `Tank`: thêm `style` (enum: `nature, iwagumi, dutch, biotope_amazon, biotope_asia, stream, paludarium, balcony_jar, foam_box, lowtech`), `shape` (`rect|jar`), `scene` `{ props: [{ refType, refId, x, y, layer, flip }], camera: { x } }`, `lightSchedule` `{ on: "08:00", off: "18:00" }`. Mặc định `style` lấy từ `suggestLayout()` (mở rộng cho đủ 10 key).
- `Species`: thêm `render` `{ spriteKey, canvas, bodyPx, swimZone: ['top'|'mid'|'bottom'], behavior, schoolMin, speed, nocturnal, clingsGlass, variants: [] }`.
- `Plant`: thêm `render` `{ spriteKey, heightPx, sway }`. `Hardscape`: thêm `spriteKey` theo `type`.
- Seed: bổ sung toàn bộ loài ở mục 5.3 với `render` đầy đủ.

### 9.2 Endpoint mới
`GET /api/tanks/:id/scene` → **TankScene DTO** (gom 1 lần, React gửi sang Godot):
```json
{
  "version": 1,
  "tank": { "id": "...", "name": "Bể phòng khách", "style": "nature", "shape": "rect",
            "dimensions": { "length": 60, "width": 30, "height": 36 }, "volume": 65,
            "equipment": ["filter", "light", "co2"], "lightSchedule": { "on": "08:00", "off": "18:00" } },
  "livestock": [ { "speciesKey": "neon_tetra", "name": "Neon xanh", "quantity": 12, "variant": null,
                   "render": { "canvas": 64, "bodyPx": 38, "swimZone": ["mid"], "behavior": "school", "speed": 1.0 } } ],
  "plants":    [ { "plantKey": "java_fern", "position": "midground", "quantity": 2 } ],
  "hardscape": [ { "type": "rock", "spriteKey": "seiryu_l", "quantity": 1 } ],
  "water":     { "temp": 25.5, "ph": 6.8, "nitrate": 15, "measuredAt": "2026-11-15T08:00:00Z" },
  "care":      { "overdue": ["water_change"], "daysSinceWaterChange": 9, "lastFed": "2026-11-17T07:30:00Z" },
  "scene":     { "props": [], "camera": { "x": 0 } },
  "warnings":  [ { "code": "FIN_NIPPER", "species": ["tiger_barb", "betta"] } ]
}
```
`PUT /api/tanks/:id/scene` → lưu bố cục sau khi kéo thả.

### 9.3 Giao thức postMessage
| Hướng | `type` | Payload | Tác dụng |
|---|---|---|---|
| React → Godot | `scene:load` | TankScene DTO | Dựng / dựng lại bể |
| React → Godot | `scene:patch` | phần DTO thay đổi | Thêm cá/cây không cần dựng lại toàn bộ |
| Godot → React | `ready` | `{ version }` | Godot sẵn sàng nhận dữ liệu |
| Godot → React | `action:feed` | `{ at }` | React ghi CareTask feeding done |
| Godot → React | `scene:save` | `scene` | React gọi `PUT /scene` |
| Godot → React | `shop:add` | `{ kind, key, qty }` | React tạo Livestock/TankPlant rồi gửi `scene:patch` |
| Godot → React | `open:species` | `{ speciesKey }` | React mở trang chi tiết loài |

Kiểm tra `event.origin` cả hai phía.

### 9.4 Ánh xạ dữ liệu người dùng → hình ảnh
| Dữ liệu | Thể hiện trong bể |
|---|---|
| Kích thước D×R×C | Tỉ lệ khung, độ rộng cảnh, số lớp parallax, mực nước (paludarium) |
| Style | Template cảnh, khung, nền, phông, palette ám, dòng chảy |
| Livestock × quantity | Số cá spawn (giới hạn hiển thị 40/loài, 120 tổng; vượt thì hiện badge "+N") |
| Plants (position) | Lớp & vị trí; số lượng → mật độ khóm |
| Hardscape | Đá/lũa theo style; Dutch bỏ qua hardscape và hiện gợi ý |
| Equipment | Có lọc → bọt + dòng nhẹ; có CO2 → bọt mịn liên tục; có đèn → tia sáng |
| Nitrate cao / lâu không thay nước | Nước đục dần (`water_tint`), hạt lơ lửng nhiều hơn |
| Quá hạn vệ sinh | Rêu xanh loang trên kính, ít caustics |
| Nhiệt độ ngoài khoảng của loài | Cá đó bơi chậm/lờ đờ + icon cảnh báo khi hover |
| pH ngoài khoảng | Icon cảnh báo trên thẻ thông tin |
| Không cho ăn > 24h | Cá tụ tầng mặt "xin ăn" khi con trỏ lại gần |
| Cá không hợp nhau (warnings) | Hành vi rượt đuổi nhẹ + cảnh báo trong HUD |
| Thể tích nhỏ so với tổng cm cá | Badge "bể quá tải" (quy tắc ~1 cm/lít đã có ở `layout.js`) |

---

## 10. Tương tác

| Tương tác | Hành vi |
|---|---|
| **Cho ăn** (nút accent / phím F) | Thả viên theo vị trí chuột; thức ăn chìm theo vật lý; cá tầng mặt đớp trước, cá đáy ăn phần rơi xuống; viên còn sót tự tan sau 60s → gửi `action:feed` |
| **Gõ kính** (click vùng trống) | Sóng vòng tròn nhỏ; cá trong bán kính giật mình bơi tản rồi tụ lại |
| **Hover / click cá** | Viền highlight 1px, thẻ thông tin (tên, tên khoa học, tầng bơi, cảnh báo thông số) — nút "Xem chi tiết" |
| **Theo dõi cá** (double-click) | Camera bám theo cá đó |
| **Kéo ngang** | Pan camera với bể dài |
| **Bật/tắt đèn** | Chuyển ngày/đêm tức thì (tween 2s) |
| **Chế độ sắp xếp** | Kéo thả cây/đá, lưới snap 4px, lật ngang, đổi lớp trước/sau, Lưu → `scene:save` |
| **Cửa hàng** (drawer `#F9F5E9`) | Duyệt cá/cây theo style, lọc theo "hợp với bể này" (nhiệt độ, pH, thể tích), thêm vào bể |
| **Chụp ảnh** | Ẩn HUD, xuất PNG 2× (tải về) |
| **Chế độ giảm chuyển động** | Tắt caustics/sway mạnh (accessibility) |

---

## 11. Lộ trình (phase) & nghiệm thu

### Phase 0 — Chuẩn bị & pilot (≈ 2 ngày)
- [ ] `git init`, `.gitignore` (art/raw, game/.godot, frontend/public/aquarium build).
- [ ] Xác nhận `agy` sinh & lưu được PNG; pilot **Neon xanh** bằng prompt template.
- [ ] Viết `tools/sprite-normalize`, `tools/aseprite/normalize.lua`, `tools/sprite-qa`; chạy với Neon.
- [ ] Chốt `aquaverse.gpl` (48 màu) sau khi xem Neon trên nền nước.
- [ ] Chọn & test font pixel tiếng Việt.
- [ ] Tạo dự án Godot rỗng, export Web thử 1 cảnh trống, nhúng iframe React chạy được.

**Nghiệm thu:** Neon 64×64 qua đủ 6 bài QA; trang `/tanks/:id/aquarium` hiện cảnh Godot rỗng nền đúng màu.

### Phase 1 — Vertical slice: Bể Nature 60×30×36 (≈ 1 tuần)
- Asset: 5 cá P1, cát + sỏi, 3 đá Seiryu, 1 lũa, 6 cây (cỏ thảm, ráy, dương xỉ, rotala, vallisneria, rêu), khung bể kính, phông tường, bọt, thức ăn, UI kit cơ bản.
- Code: TankBuilder đọc `sample_scene_nature.json`, shader bơi/sway/caustics, FishBrain (wander, school, forage, eat, flee), cho ăn, gõ kính, hover info, pan.

**Nghiệm thu:** 30 cá (12 Neon, 1 Betta, 2 Thần tiên, 8 Guppy, 6 Panda) chạy ≥ **60 FPS** trên Web (Chrome, laptop tầm trung); ảnh chụp được Claude duyệt về palette & cảm giác "cozy".

### Phase 2 — Kết nối dữ liệu thật (≈ 1 tuần)
- Backend: trường mới (9.1), seed loài, `GET/PUT /scene`, warnings tương thích.
- Frontend: route + iframe + bridge, nút "Xem bể" trong `TankDetail`, theme Tailwind theo palette.
- Godot: Bridge thật, `scene:patch`, chế độ sắp xếp & lưu.

**Nghiệm thu:** tạo bể mới trong web → thêm 10 Neon → mở bể thấy đúng 10 Neon; kéo đá, reload vẫn giữ vị trí.

### Phase 3 — Mở rộng nội dung: đủ 7 phong cách (≈ 2–3 tuần, chia batch)
- Batch A: Dutch + Low-tech · Batch B: Biotope Amazon/Á · Batch C: Stream (dòng chảy) · Batch D: Paludarium (mực nước, thác) · Batch E: Chum/Thùng xốp (mặt cắt, thời tiết).
- Cá P2 rồi P3 theo từng batch; cửa hàng lọc theo style.

**Nghiệm thu:** mỗi style có 1 file JSON mẫu dựng ra cảnh khác biệt rõ khi đặt cạnh nhau; mọi cá qua QA.

### Phase 4 — Bể "sống" theo dữ liệu (≈ 1 tuần)
- WaterQualityFx, rêu kính theo lịch quá hạn, ngày/đêm theo lịch đèn, nhiệt độ ảnh hưởng hành vi, cá nhắc cho ăn.

**Nghiệm thu:** chỉnh WaterLog nitrate 5 → 60 thấy nước đục dần; đánh dấu thay nước → nước trong trở lại.

### Phase 5 — Hoàn thiện (≈ 1 tuần)
- Âm thanh nền (róc rách, bọt, tiếng mưa cho chum) có nút tắt, chụp ảnh, giảm chuyển động, responsive mobile (chạm = click, pinch-pan), tối ưu kích thước build (gzip/brotli), loading screen pastel.

---

## 12. Danh sách task dự kiến

| ID | Agent | Nội dung | Phụ thuộc |
|---|---|---|---|
| T-001 | Codex | `tools/sprite-normalize` (Node + pngjs): lưới pixel → 64/96, ngưỡng alpha | — |
| T-002 | Codex | `tools/aseprite/normalize.lua` + `export_sheet.lua` | T-001 |
| T-003 | Codex | `tools/sprite-qa` + contact sheet | T-001 |
| A-001 | agy | Pilot Neon xanh | T-001..003 |
| A-002 | agy | Palette mở rộng + bảng màu mẫu (Claude duyệt) | A-001 |
| T-004 | Codex | Khung dự án Godot (project settings, autoload, main.tscn) + export preset Web | — |
| T-005 | Codex | React route `/tanks/:id/aquarium` + iframe + bridge giả lập | T-004 |
| A-010..015 | agy | 5 cá P1, substrate, đá, cây, khung, UI kit | A-002 |
| T-010 | Codex | TankBuilder + thứ tự lớp + style JSON `nature` | T-004 |
| T-011 | Codex | Shader `fish_swim`, `plant_sway`, `caustics`, `god_rays` | T-010 |
| T-012 | Codex | FishBrain + Boids + SwimZones | T-010 |
| T-013 | Codex | Tương tác: cho ăn, gõ kính, hover/info, pan | T-012 |
| T-020 | Codex | Backend: model fields, seed, `/scene` GET/PUT, warnings | — |
| T-021 | Codex | Bridge thật + `scene:patch` + chế độ sắp xếp | T-005, T-020 |
| T-030+ | Codex/agy | Batch style A–E | Phase 2 |
| T-040+ | Codex | WaterQualityFx, DayNight, Care visuals | Phase 3 |

---

## 13. Rủi ro & cách xử lý

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| AI sinh "giả pixel art" (lưới lệch, màu nhoè) | Asset bẩn, không nhất quán | Yêu cầu khối 16×16 trong prompt + script lấy mẫu + ép palette + QA tự động; tối đa 3 lần sinh rồi chỉnh tay |
| AI không giữ tỷ lệ giữa loài | Neon to bằng Thần tiên | Chỉ định `BODY_PX` trong prompt, script đo bbox và scale lại theo bảng 5.3 trước khi duyệt |
| `agy` không có/không lưu được ảnh | Chặn pipeline asset | Kiểm tra ở Phase 0; phương án B: dùng `backend/utils/gemini.js` (đã có) gọi model ảnh qua script Node |
| Font pixel thiếu dấu tiếng Việt | UI vỡ chữ | Test ở Phase 0; fallback dùng font pixel cho số/tiêu đề, font thường cho đoạn dài |
| Build Web nặng / chậm trên mobile | Trải nghiệm kém | Compatibility renderer, single-thread, nén Brotli, giới hạn cá hiển thị, tắt hiệu ứng nặng trên mobile |
| Boids nhiều cá tốn CPU | Tụt FPS | Spatial hash, cập nhật hàng xóm mỗi 2–3 frame, cap 120 cá |
| Shader uốn thân làm vỡ pixel | Mất chất pixel art | Lượng tử hoá offset về số nguyên pixel, biên độ ≤ 2px |
| Tên Việt ↔ loài không rõ ràng ("cá Trâm", "Bống vàng") | Vẽ sai loài | Đánh dấu cần xác nhận; dùng `speciesKey` + tên khoa học làm chuẩn |

---

## 14. Việc cần bạn xác nhận trước khi bắt đầu Phase 0
1. **"Cá Trâm"** có phải *Tanichthys albonubes* (White Cloud) không? **"Bống vàng"** có phải *Brachygobius* (Bumblebee goby) không?
2. Chấp nhận **nhúng Godot vào web hiện có** (iframe) hay muốn thêm bản **desktop .exe** độc lập?
3. Bể chum: hiển thị **mặt cắt ngang (side view)** như đề xuất, hay muốn góc nhìn **từ trên xuống**?
4. Cho phép `git init` và commit theo từng task không?
