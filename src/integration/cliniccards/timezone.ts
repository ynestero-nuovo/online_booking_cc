/**
 * Конвертація часу Cliniccards (місцевий «настінний» час салону) ↔ UTC.
 *
 * Cliniccards віддає/приймає час як "YYYY-MM-DD HH:MM:SS" без таймзони. Трактуємо
 * його як Europe/Kyiv (з урахуванням переходу на літній час) і конвертуємо в UTC,
 * бо домен зберігає час як ISO/UTC.
 */

const TZ = "Europe/Kyiv";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(instant: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** Зсув таймзони (мс) для заданого моменту: local_wall_as_utc − utc. */
function tzOffsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/** "YYYY-MM-DD HH:MM:SS" (київський настінний час) → ISO-рядок UTC. */
export function kyivWallToUtcIso(wall: string): string {
  const m = WALL_RE.exec(wall);
  if (!m) throw new Error(`Некоректний формат часу Cliniccards: ${wall}`);
  const [, Y, Mo, D, H, Mi, S] = m;
  const guess = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, S ? +S : 0);

  // Два проходи коректно обробляють межі переходу на літній/зимовий час.
  const off1 = tzOffsetMs(new Date(guess));
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc));
  if (off2 !== off1) utc = guess - off2;

  return new Date(utc).toISOString();
}

/** ISO-рядок UTC → київські { date: "YYYY-MM-DD", time: "HH:MM" }. */
export function utcIsoToKyivParts(iso: string): { date: string; time: string } {
  const p = zonedParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}
