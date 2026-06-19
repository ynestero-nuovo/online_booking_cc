/**
 * Серверна оркестрація запису (BFF-логіка).
 *
 * Поєднує провайдера даних (`getProvider`) з чистим рушієм доступності
 * (`src/domain/availability.ts`). Роути `app/api` мають лишатися тонкими й
 * викликати ці функції. Час — ISO/UTC.
 */

import {
  computeFreeSlots,
  computeFreeSlotsForService,
  groupByTimeOfDay,
} from "@/domain/availability";
import type {
  Booking,
  BookingRequest,
  Category,
  GroupedSlots,
  Service,
  Slot,
  Specialist,
} from "@/domain/types";
import { getProvider } from "@/lib/config";
import type { DateRange } from "@/integration/ports";

/** Крок сітки часу у хвилинах (на скільки дробимо зміну). */
export const STEP_MIN = 30;

export async function getSpecialists(): Promise<Specialist[]> {
  return getProvider().getSpecialists();
}

export interface ServicesResult {
  categories: Category[];
  services: Service[];
}

export async function getServicesWithCategories(): Promise<ServicesResult> {
  const provider = getProvider();
  const [categories, services] = await Promise.all([
    provider.getCategories(),
    provider.getServices(),
  ]);
  categories.sort((a, b) => a.order - b.order);
  return { categories, services };
}

export interface AvailabilityQuery {
  serviceId: string;
  /** Якщо задано — лише цей спеціаліст; інакше всі, хто надає послугу. */
  specialistId?: string;
  range: DateRange;
}

export interface AvailabilityResult {
  serviceId: string;
  durationMin: number;
  range: DateRange;
  slots: Slot[];
  groups: GroupedSlots;
}

/** Кастомна помилка з HTTP-статусом для роутів. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function resolveService(serviceId: string): Promise<Service> {
  const services = await getProvider().getServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) throw new HttpError(404, `Послугу ${serviceId} не знайдено.`);
  return service;
}

/** Спеціалісти, серед яких шукаємо слоти для послуги (з опц. звуженням). */
function resolveSpecialistIds(service: Service, specialistId?: string): string[] {
  if (!specialistId) return service.specialistIds;
  if (!service.specialistIds.includes(specialistId)) {
    throw new HttpError(400, `Спеціаліст ${specialistId} не надає послугу ${service.id}.`);
  }
  return [specialistId];
}

/** Обчислює згруповані вільні слоти для послуги (режими «по лікарю»/«по послузі»/«будь-який»). */
export async function getAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
  const provider = getProvider();
  const service = await resolveService(query.serviceId);
  const specialistIds = resolveSpecialistIds(service, query.specialistId);

  const [shifts, busy] = await Promise.all([
    provider.getShifts(query.range),
    provider.getBusy(query.range),
  ]);

  const slots = computeFreeSlotsForService(
    shifts,
    busy,
    specialistIds,
    service.durationMin,
    STEP_MIN,
  );

  return {
    serviceId: service.id,
    durationMin: service.durationMin,
    range: query.range,
    slots,
    groups: groupByTimeOfDay(slots),
  };
}

/** Перевіряє, що запитаний слот усе ще вільний у конкретного спеціаліста. */
async function assertSlotFree(request: BookingRequest): Promise<void> {
  const service = await resolveService(request.serviceIds[0]);
  if (!service.specialistIds.includes(request.specialistId)) {
    throw new HttpError(400, "Обраний спеціаліст не надає цю послугу.");
  }

  const date = request.startTime.slice(0, 10);
  const range: DateRange = { from: date, to: date };
  const provider = getProvider();
  const [shifts, busy] = await Promise.all([
    provider.getShifts(range),
    provider.getBusy(range),
  ]);

  const mineShifts = shifts.filter((s) => s.specialistId === request.specialistId);
  const free = computeFreeSlots(mineShifts, busy, service.durationMin, STEP_MIN);
  const available = free.some((slot) => slot.startTime === request.startTime);
  if (!available) {
    throw new HttpError(409, "Обраний час уже зайнято. Оновіть доступність і спробуйте ще раз.");
  }
}

/** In-memory кеш ідемпотентності: Idempotency-Key → створений Booking. */
const idempotencyCache = new Map<string, Booking>();

/**
 * Створює запис із перевіркою вільності слота (409 якщо зайнято) та
 * опційною ідемпотентністю через ключ. Повторний виклик з тим самим ключем
 * повертає той самий результат, не створюючи дубль.
 */
export async function createBooking(
  request: BookingRequest,
  idempotencyKey?: string,
): Promise<Booking> {
  if (idempotencyKey) {
    const existing = idempotencyCache.get(idempotencyKey);
    if (existing) return existing;
  }

  await assertSlotFree(request);
  const booking = await getProvider().createBooking(request);

  if (idempotencyKey) idempotencyCache.set(idempotencyKey, booking);
  return booking;
}
