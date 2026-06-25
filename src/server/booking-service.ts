/**
 * Серверна оркестрація запису (BFF-логіка).
 *
 * Поєднує провайдера даних (`getProvider`) з чистим рушієм доступності
 * (`src/domain/availability.ts`). Роути `app/api` мають лишатися тонкими й
 * викликати ці функції. Час — ISO/UTC. Форми відповідей — у `./contracts`.
 *
 * Множинний вибір: за раз можна обрати кілька послуг — тривалість сумується, а
 * шукаємо лише спеціалістів, які надають УСІ обрані послуги (перетин).
 */

import {
  commonSpecialistIds,
  computeFreeSlots,
  computeFreeSlotsForService,
} from "@/domain/availability";
import type { Booking, BookingRequest, Service, Slot } from "@/domain/types";
import { getProvider } from "@/lib/config";
import { addDaysIso, todayIsoDate } from "@/lib/date";
import type { DateRange } from "@/integration/ports";
import type {
  AvailabilityResponse,
  ServicesResponse,
  SpecialistWithAvailability,
} from "./contracts";

/** Крок сітки часу у хвилинах (на скільки дробимо зміну). */
export const STEP_MIN = 30;
/** Дефолтна тривалість для оцінки «найближчого вільного дня» (послуга ще не обрана). */
export const DEFAULT_SLOT_MIN = 30;
/** Горизонт пошуку «найближчого вільного дня», днів. */
const NEAREST_HORIZON_DAYS = 60;

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

// ───────────────────────── Спеціалісти ─────────────────────────

/**
 * Спеціалісти + найближчий вільний день кожного. День рахуємо за дефолтною
 * тривалістю слота, бо на цьому екрані послуга ще не обрана.
 */
export async function getSpecialistsWithAvailability(): Promise<SpecialistWithAvailability[]> {
  const provider = getProvider();
  const from = todayIsoDate();
  const range: DateRange = { from, to: addDaysIso(from, NEAREST_HORIZON_DAYS) };

  const [specialists, shifts, busy] = await Promise.all([
    provider.getSpecialists(),
    provider.getShifts(range),
    provider.getBusy(range),
  ]);

  return specialists.map((sp) => {
    const mineShifts = shifts.filter((s) => s.specialistId === sp.id);
    const free = computeFreeSlots(mineShifts, busy, DEFAULT_SLOT_MIN, STEP_MIN);
    const nearestFreeDate = free.length > 0 ? free[0].startTime.slice(0, 10) : null;
    return { ...sp, nearestFreeDate };
  });
}

// ───────────────────────── Послуги ─────────────────────────

export async function getServicesWithCategories(): Promise<ServicesResponse> {
  const provider = getProvider();
  const [categories, services] = await Promise.all([
    provider.getCategories(),
    provider.getServices(),
  ]);
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  return { categories: sorted, services };
}

async function resolveServices(serviceIds: string[]): Promise<Service[]> {
  if (serviceIds.length === 0) throw new HttpError(400, "Не обрано жодної послуги.");
  const all = await getProvider().getServices();
  return serviceIds.map((id) => {
    const svc = all.find((s) => s.id === id);
    if (!svc) throw new HttpError(404, `Послугу ${id} не знайдено.`);
    return svc;
  });
}

/** Сумарна тривалість обраних послуг. */
function totalDuration(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.durationMin, 0);
}

/**
 * Дедуплікація слотів за часом початку (для режиму «будь-який фахівець»): лишаємо
 * один слот на кожен час (перший за порядком — слоти вже відсортовані за startTime).
 * Кожен слот несе свій specialistId, тож бронь піде до конкретного лікаря.
 */
function dedupeByStartTime(slots: Slot[]): Slot[] {
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const s of slots) {
    if (seen.has(s.startTime)) continue;
    seen.add(s.startTime);
    out.push(s);
  }
  return out;
}

/** Спеціалісти, які надають УСІ обрані послуги (перетин), з опц. звуженням. */
function intersectSpecialists(services: Service[], specialistId?: string): string[] {
  const intersection = commonSpecialistIds(services);
  if (!specialistId) return intersection;
  if (!intersection.includes(specialistId)) {
    throw new HttpError(400, "Обраний спеціаліст не надає всі обрані послуги.");
  }
  return [specialistId];
}

// ───────────────────────── Доступність ─────────────────────────

export interface AvailabilityQuery {
  serviceIds: string[];
  /** Якщо задано — лише цей спеціаліст; інакше всі, хто надає всі послуги. */
  specialistId?: string;
  range: DateRange;
  /** За замовчуванням true (один слот на час). false → слот на кожного вільного лікаря. */
  dedup?: boolean;
}

/** Вільні слоти для набору послуг (сумарна тривалість), відсортовані за часом. */
export async function getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
  const provider = getProvider();
  const services = await resolveServices(query.serviceIds);
  const duration = totalDuration(services);
  const specialistIds = intersectSpecialists(services, query.specialistId);

  const [shifts, busy] = await Promise.all([
    provider.getShifts(query.range),
    provider.getBusy(query.range),
  ]);

  const all = computeFreeSlotsForService(shifts, busy, specialistIds, duration, STEP_MIN);
  // «Будь-який фахівець» (без звуження): один слот на час, щоб не дублювати кнопки.
  // dedup=false лишає по слоту на кожного вільного лікаря (для пошуку «хто вільний на час»).
  const slots =
    query.specialistId || query.dedup === false ? all : dedupeByStartTime(all);

  return {
    serviceIds: query.serviceIds,
    durationMin: duration,
    range: query.range,
    slots,
  };
}

// ───────────────────────── Створення запису ─────────────────────────

/** Перевіряє, що запитаний слот усе ще вільний у конкретного спеціаліста. */
async function assertSlotFree(request: BookingRequest): Promise<void> {
  const services = await resolveServices(request.serviceIds);
  intersectSpecialists(services, request.specialistId); // кине 400, якщо не надає всі
  const duration = totalDuration(services);

  const date = request.startTime.slice(0, 10);
  const range: DateRange = { from: date, to: date };
  const provider = getProvider();
  const [shifts, busy] = await Promise.all([
    provider.getShifts(range),
    provider.getBusy(range),
  ]);

  const mineShifts = shifts.filter((s) => s.specialistId === request.specialistId);
  const free = computeFreeSlots(mineShifts, busy, duration, STEP_MIN);
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
