/**
 * MockProvider — реалізація BookingProvider на фейкових даних у пам'яті.
 *
 * Призначення: розробка UI/BFF та домену без реального Cliniccards.
 * Зміни генеруються відносно поточної дати на HORIZON_DAYS днів уперед. Час — ISO/UTC.
 * Спеціалісти мають РЕАЛЬНІ `doctor_id` (як у Cliniccards), тож каталог працює без мапінгу.
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
import { CATALOG_CATEGORIES, CATALOG_SERVICES } from "./catalog";
import { kyivWallToUtcIso } from "@/lib/timezone";

const SPECIALISTS: Specialist[] = [
  { id: "79215", name: "Ковбаса Катерина", alias: "Ковбаса Катерина", role: "Головний лікар", photoUrl: "/specialists/kovbasa.png" },
  { id: "79264", name: "Самоукова Вікторія", alias: "Самоукова Вікторія", role: "Лікар", photoUrl: "/specialists/samoukova.png" },
  { id: "79716", name: "Кашицька Ольга", alias: "Кашицька Ольга", role: "Лікар", photoUrl: "/specialists/kashytska.png" },
  { id: "94758", name: "Мовчан Тетяна", alias: "Мовчан Тетяна", role: "Лікар", photoUrl: "/specialists/movchan.png" },
  { id: "88387", name: "Калашнік Катерина", alias: "Калашнік Катерина", role: "Косметолог", photoUrl: "/specialists/kalashnik.png" },
];

const CATEGORIES: Category[] = CATALOG_CATEGORIES;

// Послуги беруться зі спільного каталогу як є (specialistIds = реальні doctor_id).
const SERVICES: Service[] = CATALOG_SERVICES;

/** Робочий день у КИЇВСЬКИХ годинах: 10:00–20:00, без вихідних. */
const SHIFT_START_HOUR = 10;
const SHIFT_END_HOUR = 20;

/** Скільки днів уперед генерувати зміни (рахуючи від сьогодні). */
const HORIZON_DAYS = 60;

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

/** ISO-datetime (UTC) для київської настінної години на конкретну дату. */
function isoAt(day: Date, hour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wall = `${isoDate(day)} ${pad(hour)}:00:00`;
  return kyivWallToUtcIso(wall);
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
    for (const sp of SPECIALISTS) {
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
    // Ковбаса: ранковий візит сьогодні
    { specialistId: "79215", startTime: isoAt(day0, 10), endTime: isoAt(day0, 11) },
    // Калашнік: обідній резерв сьогодні
    { specialistId: "88387", startTime: isoAt(day0, 14), endTime: isoAt(day0, 15) },
    // Самоукова: візит завтра
    { specialistId: "79264", startTime: isoAt(day1, 12), endTime: isoAt(day1, 13) },
    // Кашицька: два візити підряд завтра
    { specialistId: "79716", startTime: isoAt(day1, 11), endTime: isoAt(day1, 13) },
    { specialistId: "79716", startTime: isoAt(day1, 13), endTime: isoAt(day1, 15) },
    // Мовчан: пізній візит післязавтра
    { specialistId: "94758", startTime: isoAt(day2, 18), endTime: isoAt(day2, 20) },
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
      // Сумарна тривалість усіх обраних послуг (узгоджено з booking-service).
      const durationMin =
        request.serviceIds.reduce(
          (sum, id) => sum + (SERVICES.find((s) => s.id === id)?.durationMin ?? 0),
          0,
        ) || 60;
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
