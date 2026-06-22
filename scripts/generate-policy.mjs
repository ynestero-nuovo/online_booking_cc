// Вбудовує тексти політик (.md) у бандл як рядки: src/lib/policy/index.ts.
// .md лишаються джерелом правди; після їх зміни — перезапусти цей скрипт.
// Запуск: node scripts/generate-policy.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/lib/policy");

// Екрануємо символи, небезпечні всередині template literal.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const terms = readFileSync(join(dir, "terms-of-service.md"), "utf8");
const privacy = readFileSync(join(dir, "privacy-policy.md"), "utf8");

const out =
  `// AUTO-GENERATED from *.md by scripts/generate-policy.mjs. Do not edit by hand.\n` +
  `export const TERMS_OF_SERVICE = \`${esc(terms)}\`;\n\n` +
  `export const PRIVACY_POLICY = \`${esc(privacy)}\`;\n`;

writeFileSync(join(dir, "index.ts"), out);
console.log(`Wrote ${join(dir, "index.ts")} (terms ${terms.length} chars, privacy ${privacy.length} chars)`);
