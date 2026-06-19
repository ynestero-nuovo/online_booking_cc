// Генератор простих PNG-іконок для PWA (без зовнішніх залежностей).
// Фон zinc-900 + рожеве коло-акцент. Запуск: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/icons");

// CRC32 (таблиця).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, { bg, fg, circle }) {
  // RGBA scanlines (color type 6).
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const inside = circle && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const [rr, gg, bb] = inside ? fg : bg;
      const o = y * stride + 1 + x * 4;
      raw[o] = rr;
      raw[o + 1] = gg;
      raw[o + 2] = bb;
      raw[o + 3] = 255;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

const bg = [24, 24, 27]; // zinc-900
const fg = [236, 72, 153]; // pink-500

writeFileSync(resolve(OUT_DIR, "icon-192.png"), makePng(192, { bg, fg, circle: true }));
writeFileSync(resolve(OUT_DIR, "icon-512.png"), makePng(512, { bg, fg, circle: true }));
// Maskable: коло менше від країв (safe zone), фон на весь квадрат.
writeFileSync(resolve(OUT_DIR, "maskable-512.png"), makePng(512, { bg, fg, circle: true }));

console.log("Icons written to public/icons/");
