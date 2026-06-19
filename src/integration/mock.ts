/**
 * MockProvider — реалізація BookingProvider на фейкових даних у пам'яті.
 *
 * Призначення: розробка UI/BFF та домену без реального Cliniccards (Крок 9).
 * Зміни генеруються відносно поточної дати на 7 днів уперед. Час — ISO/UTC.
 */

import type {
  Booking,
  BookingRequest,
  Busy,
  Category,
  IsoDate,
  Service,
  Shift,
  Specialist,
} from "@/domain/types";
import type { BookingProvider, DateRange } from "./ports";

const SPECIALISTS: Specialist[] = [
  { id: "sp-anna", name: "Анна Коваль", alias: "Анна", role: "Манікюр майстер" },
  { id: "sp-olha", name: "Ольга Шевченко", alias: "Ольга", role: "Манікюр топмайстер" },
  { id: "sp-iryna", name: "Ірина Бондар", alias: "Ірина", role: "Педикюр майстер" },
  { id: "sp-maria", name: "Марія Ткаченко", alias: "Марія", role: "Топмайстер" },
  { id: "sp-kateryna", name: "Катерина Лис", alias: "Катя", role: "Манікюр майстер" },
];

const CATEGORIES: Category[] = [
  { id: "cat-top", name: "Топ-послуги", order: 0 },
  { id: "cat-mani", name: "Манікюр", order: 1 },
  { id: "cat-pedi", name: "Педикюр", order: 2 },
];

const SERVICES: Service[] = [
  {
    id: "svc-mani-classic",
    name: "Класичний манікюр",
    categoryId: "cat-mani",
    durationMin: 60,
    price: 350,
    specialistIds: ["sp-anna", "sp-kateryna"],
  },
  {
    id: "svc-mani-gel",
    name: "Манікюр + гель-лак",
    categoryId: "cat-mani",
    durationMin: 90,
    price: 500,
    specialistIds: ["sp-anna", "sp-olha", "sp-kateryna"],
  },
  {
    id: "svc-mani-top",
    name: "Манікюр у топмайстра",
    categoryId: "cat-top",
    durationMin: 90,
    price: 700,
    specialistIds: ["sp-olha", "sp-maria"],
  },
  {
    id: "svc-pedi-classic",
    name: "Класичний педикюр",
    categoryId: "cat-pedi",
    durationMin: 90,
    price: 600,
    specialistIds: ["sp-iryna"],
  },
  {
    id: "svc-pedi-spa",
    name: "SPA-педикюр",
    categoryId: "cat-pedi",
    durationMin: 120,
    price: 800,
    specialistIds: ["sp-iryna", "sp-maria"],
  },
];

/** Робочий день у годинах UTC: 09:00–18:00. */
const SHIFT_START_HOUR = 9;
const SHIFT_END_HOUR = 18;

/** Скільки днів уперед генерувати зміни (рахуючи від сьогодні). */
const HORIZON_DAYS = 7;

/** Вихідний день кожного спеціаліста (0 = неділя ... 6 = субота). */
const DAY_OFF: Record<string, number> = {
  "sp-anna": 1, // понеділок
  "sp-olha": 2,
  "sp-iryna": 3,
  "sp-maria": 0, // неділя
  "sp-kateryna": 4,
};

/** Початок сьогоднішнього дня в UTC. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** ISO-дата "YYYY-MM-DD" з Date (UTC). */
function isoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** ISO-datetime для конкретної дати + години (UTC). */
function isoAt(day: Date, hour: number): string {
  const d = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour),
  );
  return d.toISOString();
}

/** Чи входить дата у діапазон (включно). */
function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/** Генерує зміни всіх спеціалістів на HORIZON_DAYS днів від сьогодні. */
function buildShifts(): Shift[] {
  const shifts: Shift[] = [];
  const base = startOfTodayUtc();
  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + offset);
    const weekday = day.getUTCDay();
    for (const sp of SPECIALISTS) {
      if (DAY_OFF[sp.id] === weekday) continue;
      shifts.push({
        specialistId: sp.id,
        date: isoDate(day),
        startTime: isoAt(day, SHIFT_START_HOUR),
        endTime: isoAt(day, SHIFT_END_HOUR),
      });
    }
  }
  return shifts;
}

/** Генерує кілька зайнятих інтервалів у найближчі дні. */
function buildBusy(): Busy[] {
  const base = startOfTodayUtc();
  const day0 = base;
  const day1 = new Date(base);
  day1.setUTCDate(base.getUTCDate() + 1);
  const day2 = new Date(base);
  day2.setUTCDate(base.getUTCDate() + 2);

  return [
    // Анна: ранковий візит сьогодні
    { specialistId: "sp-anna", startTime: isoAt(day0, 9), endTime: isoAt(day0, 10) },
    // Анна: обідній резерв сьогодні
    { specialistId: "sp-anna", startTime: isoAt(day0, 13), endTime: isoAt(day0, 14) },
    // Ольга: візит завтра
    { specialistId: "sp-olha", startTime: isoAt(day1, 11), endTime: isoAt(day1, 12) },
    // Ірина: два візити підряд завтра
    { specialistId: "sp-iryna", startTime: isoAt(day1, 10), endTime: isoAt(day1, 12) },
    { specialistId: "sp-iryna", startTime: isoAt(day1, 12), endTime: isoAt(day1, 14) },
    // Марія: пізній візит післязавтра
    { specialistId: "sp-maria", startTime: isoAt(day2, 16), endTime: isoAt(day2, 18) },
  ];
}

/** Створює новий MockProvider з ізольованим станом у пам'яті. */
export function createMockProvider(): BookingProvider {
  const shifts = buildShifts();
  const busy = buildBusy();
  const bookings: Booking[] = [];
  let seq = 0;

  return {
    async getSpecialists() {
      return SPECIALISTS;
    },
    async getCategories() {
      return CATEGORIES;
    },
    async getServices() {
      return SERVICES;
    },
    async getShifts(range: DateRange) {
      return shifts.filter((s) => inRange(s.date, range));
    },
    async getBusy(range: DateRange) {
      return busy.filter((b) => inRange(b.startTime.slice(0, 10), range));
    },
    async createBooking(request: BookingRequest) {
      const booking: Booking = {
        ...request,
        id: `bk-${++seq}`,
        status: "confirmed",
      };
      bookings.push(booking);
      // Резервуємо час, аби наступні запити доступності його враховували.
      // Тривалість бере перша послуга; для мока цього достатньо.
      const durationMin = SERVICES.find((s) => s.id === request.serviceIds[0])?.durationMin ?? 60;
      const start = new Date(request.startTime);
      const end = new Date(start.getTime() + durationMin * 60_000);
      busy.push({
        specialistId: request.specialistId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      return booking;
    },
  };
}
