// Зменшує фото спеціалістів у public/specialists до 256x256 (cover).
// Аватари показуються 40–48px, тож великі оригінали не потрібні у served-теці.
// Запуск: node scripts/resize-photos.mjs
import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/specialists");
const SIZE = 256;

for (const f of readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".png"))) {
  const p = join(dir, f);
  const buf = await sharp(p)
    .resize(SIZE, SIZE, { fit: "cover", position: "top" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(p, buf);
  console.log(`${f}: ${(buf.length / 1024).toFixed(0)} KB`);
}
