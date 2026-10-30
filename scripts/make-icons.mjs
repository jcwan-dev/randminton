// Draws the app icons (the shuttlecock logo on lime) as PNGs, with no dependencies.
// Run with: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const LIME = [198, 242, 78];
const INK = [18, 32, 26];

// The logo on a 24-unit grid, as in the app's icon: a ring and four strokes, 2 units wide.
const RING = { x: 7, y: 17, r: 3 };
const STROKES = [[9, 15, 18, 6], [14, 4, 20, 10], [16, 5, 14, 10], [14, 10, 19, 8]];

function segmentDistance(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const onLogo = (u, v) =>
  Math.abs(Math.hypot(u - RING.x, v - RING.y) - RING.r) <= 1 ||
  STROKES.some(s => segmentDistance(u, v, s) <= 1);

// `rounded`: lime rounded square with see-through corners. Otherwise lime to the edges (maskable),
// with the logo smaller so it stays inside the circle Android may crop to.
function draw(size, { rounded, logoScale }) {
  const SS = 4; // samples per pixel side, for smooth edges
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 24;
          const v = ((y + (sy + 0.5) / SS) / size) * 24;
          if (rounded) {
            const radius = 5.5;
            const ex = Math.max(Math.abs(u - 12) - (12 - radius), 0);
            const ey = Math.max(Math.abs(v - 12) - (12 - radius), 0);
            if (ex * ex + ey * ey > radius * radius) continue;
          }
          const color = onLogo(12 + (u - 12) / logoScale, 12 + (v - 12) / logoScale) ? INK : LIME;
          r += color[0]; g += color[1]; b += color[2]; a += 255;
        }
      }
      const n = SS * SS, i = (y * size + x) * 4;
      const cover = a / 255 || 1;
      pixels[i] = Math.round(r / cover);
      pixels[i + 1] = Math.round(g / cover);
      pixels[i + 2] = Math.round(b / cover);
      pixels[i + 3] = Math.round(a / n);
    }
  }
  return png(size, pixels);
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', draw(192, { rounded: true, logoScale: 0.75 }));
writeFileSync('icons/icon-512.png', draw(512, { rounded: true, logoScale: 0.75 }));
writeFileSync('icons/maskable-512.png', draw(512, { rounded: false, logoScale: 0.6 }));
writeFileSync('icons/apple-touch-icon.png', draw(180, { rounded: false, logoScale: 0.7 }));
console.log('Icons written to icons/');
