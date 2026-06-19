/**
 * Хелпери форматування часу/дати для UI.
 * Час у домені — UTC; відображаємо в UTC, щоб збігалося з групуванням сервера.
 */

const timeFmt = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "09:00" з ISO-datetime (UTC). */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "чт, 19 черв." з ISO-дати "YYYY-MM-DD". */
export function formatDateLabel(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Список наступних N ISO-дат (UTC), починаючи з сьогодні. */
export function nextDates(count: number): string[] {
  const today = new Date();
  const baseMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, i) =>
    new Date(baseMs + i * dayMs).toISOString().slice(0, 10),
  );
}

/** Ціна у грн (мок зберігає ціле число гривень). */
export function formatPrice(price: number): string {
  return `${price} ₴`;
}
