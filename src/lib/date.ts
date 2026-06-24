/**
 * Спільні хелпери для ISO-дат "YYYY-MM-DD" (UTC-календар, без таймзонної логіки).
 *
 * Чистий модуль — безпечний і на сервері, і в клієнті. Київські конвертації — у
 * `@/lib/timezone`; тут лише арифметика над ISO-датами.
 */

const MS_PER_DAY = 86_400_000;

/** Сьогоднішня дата "YYYY-MM-DD" в UTC. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO-дата + N днів (N може бути від'ємним). Повертає "YYYY-MM-DD". */
export function addDaysIso(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}
