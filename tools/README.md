# AquaVerse sprite tools

Node.js **v25**, ESM; dependency duy nhất: `pngjs` (không Python, không native canvas).
Từ thư mục repo:

```sh
cd tools
npm install
npm test
```

## 1. Normalize ảnh AI

Các lệnh Node dưới đây chạy trong `tools/`:

```sh
npm run normalize -- --in ../art/raw/neon_tetra.png --out ../art/export/fish/fish_neon_tetra.png --canvas 64
node sprite-normalize/index.mjs --in ../art/raw/betta.png --out ../art/export/fish/fish_betta.png --canvas 64 --cell 16 --palette ../art/palette/aquaverse.gpl --padding 4 --max-colors 16 --bg-tol 24
node sprite-normalize/index.mjs --in ../art/raw/neon_tetra.png --out out/neon38.png --canvas 64 --target-w 38
node sprite-normalize/index.mjs --in ../art/raw/plant.png --out out/plant.png --canvas 32x112 --target-h 100 --anchor bottom
node sprite-normalize/index.mjs --in ../art/raw/rock.png --out out/rock.png --canvas 96x64 --target-w 48 --anchor bottom
node sprite-normalize/index.mjs --in ../art/raw/sand.png --out out/sand16.png --tile 16
node sprite-normalize/index.mjs --help
```

- Nếu có bất kỳ alpha < 255, công cụ dùng alpha thật: **≥128 giữ**, còn lại trong suốt. Nếu ảnh hoàn toàn opaque, công cụ ước lượng nền từ bốn cạnh rồi flood-fill 4 hướng. Hỗ trợ nền đặc và bàn cờ hai màu sáng trung tính. `--bg-tol` là sai lệch tối đa **mỗi kênh RGB** (0–255), mặc định 24.
- `--cell auto` (mặc định) tìm ước số phổ biến của độ dài các đoạn màu theo hàng/cột trong khoảng **4–32px**. Đoạn nền bị loại khỏi phép đo; offset X/Y được suy ra từ vị trí chuyển màu. Có thể ép cell bằng số nguyên dương, kể cả `--cell 1` cho ảnh đã đúng kích thước.
- `--target-w <n>` hoặc `--target-h <n>` bỏ qua dò cell: đo bbox foreground trên ảnh raw **sau tách nền**, rồi tính `cell = bbox.width/n` hoặc `bbox.height/n`. Cell có thể là số thực (ví dụ **13,5px**); dùng cùng tỷ lệ cho cả hai trục để giữ tỷ lệ sprite. Lưới căn theo mép trái/trên bbox, lấy mẫu với tọa độ thực và lõi giữa 60%, chỉ đổi sang chỉ số pixel nguyên khi đọc ảnh. Mục tiêu là bbox đầu ra rộng/cao `n±1` pixel logic; kiểm tra lại nếu ảnh có chi tiết rất mảnh hoặc nền nhiễu. `--cell`, `--target-w`, `--target-h`, `--tile` loại trừ lẫn nhau, kể cả `--cell auto` được truyền tường minh. `n` là số nguyên 1–1024.
- Mỗi ô lấy màu xuất hiện nhiều nhất trong **lõi giữa 60%**. Tỷ lệ nền được tính trên **toàn bộ ô**; nếu >50% là nền thì ô trong suốt. Phần ô ngoài ảnh không tham gia tỷ lệ; ô bị cắt không có lõi dùng phần còn nhìn thấy.
- Màu được ánh xạ theo khoảng cách cảm nhận **redmean** vào GPL. Nếu vượt `--max-colors` (mặc định 16), lần lượt gộp màu ít dùng nhất vào màu gần nhất còn lại, cập nhật tần suất sau mỗi lần gộp.
- `--canvas <n|WxH>` nhận canvas vuông (`64`, `96`) hoặc chữ nhật (`96x64`, `32x112`), mỗi chiều 1–1024px. Crop theo phần nhìn thấy; `--anchor center` (mặc định) căn giữa từng trục bằng `floor((canvasSize - bboxSize)/2)`, padding mặc định **4px mỗi cạnh**. `--anchor bottom` căn giữa ngang, đáy bbox chạm đáy canvas (padding đáy **0**); ba cạnh còn lại vẫn phải đạt `--padding`. Không co giãn sprite để ép vừa canvas.

### Tile liền mạch

`--tile <n>` lấy mẫu **toàn bộ ảnh** thành `n×n` pixel logic, kể cả ảnh raw chữ nhật: cell ngang = `raw.width/n`, cell dọc = `raw.height/n`. Không tách nền, crop, căn neo hoặc áp padding; mọi ô được lấy màu RGB và xuất opaque, rồi ép palette/giới hạn số màu như sprite. Không cần `--canvas`; nếu truyền canvas thì tile vẫn xuất `n×n`.

JSON có `tile`, `seamScore` và `cell` (thêm `cellY` nếu ảnh raw chữ nhật). `seamScore` là trung bình chênh lệch tuyệt đối RGBA, chia 255, của mọi cặp pixel cột trái/phải và hàng trên/dưới **sau ép palette**, trong khoảng **0–1**: **0** khi các mép khớp hoàn toàn, càng lớn càng lệch. Đây là phép so sánh mép để soi đường nối, không phải đánh giá texture tổng thể. Công cụ **không tự sửa mép**, không làm FAIL theo score; xem sheet lặp 3×3 để quyết định chỉnh ảnh. Tile không có anchor/pivot.

PNG đầu ra là RGBA, alpha chỉ 0/255. stdout là một dòng JSON; lỗi ghi stderr. Metadata được lưu theo đúng tên **`<out>.json`**: ví dụ `fish_neon_tetra.png.json`.

```json
{
  "cell": 16,
  "offset": { "x": 3, "y": 3 },
  "logicalSize": { "width": 65, "height": 65 },
  "bbox": { "x": 10, "y": 18, "width": 44, "height": 28 },
  "colors": 7,
  "warnings": [],
  "anchor": "center",
  "pivot": { "x": 32, "y": 32 }
}
```

`offset` là gốc lưới modulo cell trong tọa độ ảnh raw; có thể là số thực khi dùng target. `logicalSize` là kích thước lưới **trước crop**, kể cả ô bị cắt ở mép (1024px lệch 3px trên lưới 16px có 65 ô). `bbox` dùng tọa độ pixel trên **canvas đầu ra**, gốc trên trái, kích thước bao gồm pixel cuối. `anchor` có trong stdout và sidecar. `pivot` chỉ có trong sidecar, theo tọa độ mép pixel, có thể là số lẻ 0.5: với `center` giữ hành vi cũ `{x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2}`; với `bottom` dùng **điểm giữa đáy** `{x: bbox.x + bbox.width/2, y: bbox.y + bbox.height}`.

Exit **0**: thành công; **2**: bbox cộng padding theo anchor không vừa canvas; **1**: sai tham số, file không đọc được, không có foreground hoặc không dò được lưới. Trường hợp không vừa không ghi PNG/metadata mới.

Dò lưới là heuristic: hình quá ít cạnh, lưới không đều, ảnh JPEG có nhiễu hoặc cell ngoài khoảng auto có thể cần ép `--cell` hoặc dùng target theo kích thước thân mong muốn. Đầu vào phải là PNG; đổi JPG sang PNG trước khi chạy (đổi đuôi file không đủ). Nền chỉ bị xóa nếu liên thông với cạnh ảnh; chi tiết trắng nằm kín trong thân được giữ. Nền gần màu cá và các lỗ nền bị bao kín cần xem lại contact sheet/chỉnh tay trong Aseprite. Công cụ cảnh báo khi ít bằng chứng lưới hoặc foreground chạm mép ảnh raw.

## 2. QA và contact sheet

```sh
npm run qa -- --dir ../art/export/fish --palette ../art/palette/aquaverse.gpl --max-colors 16 --padding 4 --report test/out/fish_qa.json --sheet test/out/fish_contact.png
node sprite-qa/index.mjs --dir out/plants --sizes 32x112,96x64 --anchor bottom --report test/out/plants.json --sheet test/out/plants.png
node sprite-qa/index.mjs --dir out/tiles --sizes 16x16 --tile --report test/out/tiles.json --sheet test/out/tiles.png
node sprite-qa/index.mjs --help
```

Quét PNG đệ quy, không phân biệt hoa/thường ở đuôi file, sắp xếp theo đường dẫn. Mỗi file có `status` và 5 mục `checks` với **PASS/FAIL**:

1. `palette`: RGB của mọi pixel có alpha > 0 thuộc palette.
2. `alpha`: chỉ 0/255.
3. `colors`: số màu nhìn thấy ≤ giới hạn.
4. `padding`: khoảng trống trái/trên/phải/dưới ≥ min. Với `--anchor bottom`, ba cạnh trái/trên/phải ≥ min, đáy **phải bằng 0**. Với `--tile`, bỏ qua kiểm tra này (`PASS`, `skipped: true`).
5. `canvas`: nằm trong danh sách `--sizes WxH,WxH,...`; mặc định giữ **64×64 hoặc 96×96**. Tile 16×16 cần truyền `--sizes 16x16`; `--tile` không tự đổi kích thước hợp lệ.

RGB ẩn dưới alpha=0 không tính vào palette/số màu. Sprite rỗng thất bại mục padding; PNG hỏng thất bại cả 5 mục. Thư mục không có PNG cũng FAIL. Report có `summary: {total, passed, failed}`, `files`, `sheetRow` (đánh số từ 0, `null` nếu PNG không đọc được). stdout cũng in report JSON. Exit **1** nếu có FAIL hoặc lỗi; **0** nếu tất cả PASS.

Mỗi sprite đọc được có một hàng, theo cùng thứ tự report, gồm:

| Cột | Nội dung | Nền |
|---|---|---|
| 1 | Ảnh 1× | `#B8E1D5` |
| 2 | Ảnh 4× nearest-neighbor | `#B8E1D5` |
| 3 | Silhouette 4× màu `#35574F` | `#F9F5E9` |
| 4 | Ảnh 1× | `#76B5A5` |

Khoảng cách giữa ô/hàng và lề ngoài **8px**; nền tổng `#EAF6F2`. Với các canvas khác nhau, chiều rộng cột theo sprite rộng nhất; hàng theo chiều cao của từng sprite. Sheet không có nhãn chữ; dùng `sheetRow` trong report để tra tên. Đường dẫn sheet được loại khỏi đầu vào khi chạy lại QA. Nên lưu sheet ngoài thư mục sprite để không bị đưa vào lần export/QA khác.

Sprite chữ nhật được giữ đúng tỷ lệ: mỗi hàng đủ cao cho ảnh cao nhất trong hàng (ảnh 4×), không cắt ảnh theo chiều rộng. Với `--tile`, cả bốn cột hiển thị **tile lặp 3×3** ở tỷ lệ tương ứng; không có khe giữa các bản lặp để soi đường nối. Report tile cũng ghi `seamScore` theo cùng công thức normalize, không làm FAIL theo score.

## 3. Aseprite: GPL → indexed → .aseprite

Chạy từ **gốc repo**, sau bước Node normalize:

```sh
aseprite -b art/export/fish/fish_neon_tetra.png --script-param palette=art/palette/aquaverse.gpl --script-param out=art/source/fish/neon_tetra.aseprite --script tools/aseprite/normalize.lua
```

Đảm bảo thư mục output tồn tại. Script dùng sprite đang active, `Palette{ fromFile = ... }`, chuyển sang `ColorMode.INDEXED` không dithering và lưu `.aseprite`. Script báo lỗi rõ ràng nếu thiếu `palette`, `out`, sprite đang mở hoặc palette không đọc được. Script này chỉ ép palette/indexed; bước tách nền, lưới, crop và padding nằm trong công cụ Node.

Nếu Aseprite chưa có trong PATH trên Windows/PowerShell, thay `aseprite` bằng `& "D:/Avatar/asesprite/aseprite.exe"`.

Export sheet từ gốc repo:

```sh
aseprite -b art/source/fish/*.aseprite --sheet art/export/fish/fish_sheet.png --data art/export/fish/fish_sheet.json --format json-array
```

QA từng sprite **trước khi** xuất atlas; `fish_sheet.png` là atlas, không phải canvas 64/96 để QA.

## Kiểm thử

`npm test` tự tạo sprite 64×64, phóng thành ảnh 1024×1024 với cell 16, offset 3px, nền trắng hoặc bàn cờ lệch lưới và nhiễu ±6 tại biên khối. Chạy CLI thật rồi kiểm tra **≥98%** pixel tổng và pixel foreground khớp sprite gốc, đồng thời kiểm tra cell/offset/metadata chính xác. Các case khác bao gồm nền xám, cell 8/12/20/24/32, ép cell, alpha 127/128, chi tiết trắng bên trong cá, gộp màu, exit 2, đủ 5 mục QA, PNG hỏng, thư mục rỗng, canvas 96, contact sheet 1×/4× và `--help`.

Test chỉ ghi fixture tạm trong `tools/test/out/` rồi tự dọn; không sửa `art/` và không cần Aseprite để chạy test Node.

Các test Phase 1 bổ sung: target-w/target-h với ảnh giả cell **13,5px**, offset căn bbox và màu lõi 60%; canvas chữ nhật với anchor bottom/pivot/padding ba cạnh; tile 16×16 từ ảnh raw chữ nhật, giữ nguyên nền và mép lỗi, seamScore trước/sau gộp màu; CLI QA `--sizes`/`--anchor`/`--tile`, sprite nhiều tỷ lệ và xác minh đủ chín bản lặp trên contact sheet. Test kiểm tra cả tham số sai và các chế độ loại trừ nhau.
