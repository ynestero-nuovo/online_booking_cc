/**
 * Порт інтеграції: інтерфейс провайдера бронювання.
 *
 * UI/BFF залежать від цього інтерфейсу, а не від конкретного джерела даних.
 * Реалізації: MockProvider (зараз) та CliniccardsProvider (Крок 9).
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

/** Діапазон дат (включно), ISO "YYYY-MM-DD". */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * Єдина точка доступу до даних запису.
 *
 * Усі методи асинхронні. Провайдер повертає сирі дані (спеціалісти, зміни,
 * зайнятість); обчислення вільних слотів робить домен (`src/domain/availability.ts`).
 */
export interface BookingProvider {
  getSpecialists(): Promise<Specialist[]>;
  getCategories(): Promise<Category[]>;
  getServices(): Promise<Service[]>;
  /** Зміни всіх спеціалістів у межах діапазону дат. */
  getShifts(range: DateRange): Promise<Shift[]>;
  /** Зайняті інтервали (візити + резерви) у межах діапазону дат. */
  getBusy(range: DateRange): Promise<Busy[]>;
  /** Створює запис. Реалізація має бути ідемпотентною за бажанням виклику. */
  createBooking(request: BookingRequest): Promise<Booking>;
}
