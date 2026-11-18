// Chuyển bản vẽ pixel viết tay (.px) thành PNG. Không sinh hình — chỉ tô đúng các pixel được ghi trong file.
//
// Cú pháp file .px:
//   SIZE <w> <h>
//   C <char> #RRGGBB          khai báo màu cho 1 ký tự
//   G <x> <y>                 bắt đầu khối lưới đặc; các dòng tiếp theo là hàng pixel, kết thúc bằng END
//   P <x>,<y>:<pattern> ...   đặt chuỗi pixel theo hàng ngang tại (x,y); '.' = bỏ qua
//   V <x> <y0> <y1> <pattern> lặp pattern trên mỗi hàng y0..y1 (nét dọc)
//   # ...                     chú thích
// Usage: node pixelgrid/index.mjs <in.px> <out.png>
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node pixelgrid/index.mjs <in.px> <out.png>');
  process.exit(1);
}

const lines = fs.readFileSync(inPath, 'utf8').split(/\r?\n/);
const colors = new Map();
let png = null;
let grid = null;
const errors = [];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const put = (x, y, ch, ln) => {
  if (ch === '.') return;
  if (!colors.has(ch)) return errors.push(`line ${ln}: unknown color '${ch}'`);
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return errors.push(`line ${ln}: (${x},${y}) out of bounds`);
  const [r, g, b] = colors.get(ch);
  const i = (y * png.width + x) * 4;
  png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
};
const row = (x, y, pattern, ln) => [...pattern].forEach((ch, i) => put(x + i, y, ch, ln));

lines.forEach((raw, idx) => {
  const ln = idx + 1;
  const line = raw.trim();
  if (grid) {
    if (line === 'END') { grid = null; return; }
    row(grid.x, grid.y++, line, ln);
    return;
  }
  if (!line || line.startsWith('#')) return;
  const [cmd, ...args] = line.split(/\s+/);
  if (cmd === 'SIZE') {
    png = new PNG({ width: +args[0], height: +args[1] });
    png.data.fill(0);
  } else if (cmd === 'C') {
    colors.set(args[0], hex(args[1]));
  } else if (cmd === 'G') {
    grid = { x: +args[0], y: +args[1] };
  } else if (cmd === 'P') {
    for (const item of args) {
      const m = item.match(/^(-?\d+),(-?\d+):(.+)$/);
      if (!m) { errors.push(`line ${ln}: bad P item '${item}'`); continue; }
      row(+m[1], +m[2], m[3], ln);
    }
  } else if (cmd === 'V') {
    const [x, y0, y1, pattern] = args;
    for (let y = +y0; y <= +y1; y++) row(+x, y, pattern, ln);
  } else {
    errors.push(`line ${ln}: unknown command '${cmd}'`);
  }
});

if (errors.length) {
  console.error(errors.slice(0, 20).join('\n'));
  process.exit(2);
}
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log(`wrote ${outPath} ${png.width}x${png.height}`);
