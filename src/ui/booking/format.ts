/**
 * Хелпери форматування часу/дати для UI.
 * Час у домені — UTC; відображаємо в UTC, щоб збігалося з групуванням сервера.
 */

import type { Slot, TimeGroup } from "@/domain/types";

const timeFmt = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const dateShortFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** "09:00" з ISO-datetime (UTC). */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "19 червня" з ISO-дати "YYYY-MM-DD". */
export function formatDateLong(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "19.06.2026" з ISO-дати. */
export function formatDateShort(isoDate: string): string {
  return dateShortFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Тривалість у людському вигляді: 90 → "1 год 30 хв". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} хв`;
  if (m === 0) return `${h} год`;
  return `${h} год ${m} хв`;
}

/** Ціна у грн. */
export function formatPrice(price: number): string {
  return `${price} ₴`;
}

export const TIME_GROUP_LABEL: Record<TimeGroup, string> = {
  morning: "Ранок",
  afternoon: "День",
  evening: "Вечір",
};
export const TIME_GROUP_ORDER: TimeGroup[] = ["morning", "afternoon", "evening"];

/** UTC-дата слота "YYYY-MM-DD". */
export function slotDate(slot: Slot): string {
  return slot.startTime.slice(0, 10);
}

/** Групує слоти одного дня на Ранок/День/Вечір (за UTC-годиною початку). */
export function groupSlots(slots: Slot[]): Record<TimeGroup, Slot[]> {
  const groups: Record<TimeGroup, Slot[]> = { morning: [], afternoon: [], evening: [] };
  for (const s of slots) {
    const hour = new Date(s.startTime).getUTCHours();
    const g: TimeGroup = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    groups[g].push(s);
  }
  return groups;
}

// ───────────────────────── Календар ─────────────────────────

const MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];
export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  label: string; // "Червень 2026"
  /** Сітка тижнів: дати "YYYY-MM-DD" або null (порожня клітинка). Тиждень з понеділка. */
  weeks: (string | null)[][];
}

function isoOf(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().slice(0, 10);
}

/** Будує сітку місяця (тижні з понеділка) для відображення календаря. */
export function buildCalendar(year: number, month: number): CalendarMonth {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay: 0=нд..6=сб → зсув для тижня з понеділка.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, label: `${MONTHS[month]} ${year}`, weeks };
}

/** Місяць як {year, month} з ISO-дати. */
export function monthOf(isoDate: string): { year: number; month: number } {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}
