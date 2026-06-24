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
import { CATALOG_CATEGORIES, type DoctorKey } from "./catalog";
import { catalogToServices } from "./catalog-services";
import { kyivWallToUtcIso } from "@/lib/timezone";

const SPECIALISTS: Specialist[] = [
  { id: "sp-kovbasa", name: "Катерина Ковбаса", alias: "Катерина Ковбаса", role: "Головний лікар", photoUrl: "/specialists/kovbasa.png" },
  { id: "sp-samoukova", name: "Вікторія Самоукова", alias: "Вікторія Самоукова", role: "Лікар", photoUrl: "/specialists/samoukova.png" },
  { id: "sp-kashytska", name: "Ольга Кашицька", alias: "Ольга Кашицька", role: "Лікар", photoUrl: "/specialists/kashytska.png" },
  { id: "sp-movchan", name: "Тетяна Мовчан", alias: "Тетяна Мовчан", role: "Лікар", photoUrl: "/specialists/movchan.png" },
  { id: "sp-kalashnik", name: "Катерина Калашнік", alias: "Катерина Калашнік", role: "Косметолог", photoUrl: "/specialists/kalashnik.png" },
];

const CATEGORIES: Category[] = CATALOG_CATEGORIES;

/** Ключ лікаря з каталогу → mock-id спеціаліста. */
const MOCK_ID: Record<DoctorKey, string> = {
  kovbasa: "sp-kovbasa",
  samoukova: "sp-samoukova",
  kashytska: "sp-kashytska",
  movchan: "sp-movchan",
  kalashnik: "sp-kalashnik",
};

// Прив'язка послуга→спеціаліст береться з каталогу (providers із прайс-мапи).
const SERVICES: Service[] = catalogToServices(MOCK_ID);

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
    { specialistId: "sp-kovbasa", startTime: isoAt(day0, 10), endTime: isoAt(day0, 11) },
    // Калашнік: обідній резерв сьогодні
    { specialistId: "sp-kalashnik", startTime: isoAt(day0, 14), endTime: isoAt(day0, 15) },
    // Самоукова: візит завтра
    { specialistId: "sp-samoukova", startTime: isoAt(day1, 12), endTime: isoAt(day1, 13) },
    // Кашицька: два візити підряд завтра
    { specialistId: "sp-kashytska", startTime: isoAt(day1, 11), endTime: isoAt(day1, 13) },
    { specialistId: "sp-kashytska", startTime: isoAt(day1, 13), endTime: isoAt(day1, 15) },
    // Мовчан: пізній візит післязавтра
    { specialistId: "sp-movchan", startTime: isoAt(day2, 18), endTime: isoAt(day2, 20) },
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
