/**
 * Контракти HTTP-API (BFF ↔ UI) — ЄДИНЕ ДЖЕРЕЛО ПРАВДИ для форм відповідей `/api/*`.
 *
 * Тільки типи: жодного рантайму й жодних секретів, лише `import type` з домену.
 * Тому файл безпечно імпортувати і на сервері (`booking-service`), і в клієнті
 * (`ui/booking/api`) — так серверний і клієнтський контракти не можуть розійтися.
 */

import type { Booking, Category, IsoDate, Service, Slot, Specialist } from "@/domain/types";

/** GET /api/specialists → `{ specialists }`. Спеціаліст + найближчий вільний день. */
export interface SpecialistWithAvailability extends Specialist {
  /** Найближча дата з вільним слотом (за дефолтною тривалістю) або null. */
  nearestFreeDate: IsoDate | null;
}

/** GET /api/services. */
export interface ServicesResponse {
  categories: Category[];
  services: Service[];
}

/** GET /api/availability. */
export interface AvailabilityResponse {
  serviceIds: string[];
  durationMin: number;
  range: { from: IsoDate; to: IsoDate };
  slots: Slot[];
}

/** Конверт GET /api/specialists. */
export interface SpecialistsEnvelope {
  specialists: SpecialistWithAvailability[];
}

/** Конверт POST /api/bookings. */
export interface BookingEnvelope {
  booking: Booking;
}
