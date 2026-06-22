// Генерує бренд-асети з логотипа (src/img/logo/logo.png):
// public/logo.png (шапка), PWA-іконки 192/512/maskable, src/app/icon.png (favicon).
// Запуск: node scripts/generate-logo-assets.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/img/logo/logo.png");
const white = { r: 255, g: 255, b: 255, alpha: 1 };

mkdirSync(join(root, "public/icons"), { recursive: true });

async function plain(size, out) {
  const buf = await sharp(SRC)
    .resize(size, size, { fit: "contain", background: white })
    .flatten({ background: white })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(out, buf);
  console.log(`${out}: ${(buf.length / 1024).toFixed(0)} KB`);
}

// Maskable: лого на ~78% від полотна (safe zone), щоб ОС-маска не зрізала кільце.
async function maskable(size, out) {
  const inner = Math.round(size * 0.78);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: white })
    .flatten({ background: white })
    .toBuffer();
  const buf = await sharp({ create: { width: size, height: size, channels: 3, background: white } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(out, buf);
  console.log(`${out}: ${(buf.length / 1024).toFixed(0)} KB`);
}

await plain(256, join(root, "public/logo.png"));
await plain(192, join(root, "public/icons/icon-192.png"));
await plain(512, join(root, "public/icons/icon-512.png"));
await maskable(512, join(root, "public/icons/maskable-512.png"));
await plain(512, join(root, "src/app/icon.png"));
console.log("logo assets generated");
