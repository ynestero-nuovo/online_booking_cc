/**
 * Клієнтський доступ до власних BFF-роутів `/api/*`.
 * Фронт НІКОЛИ не ходить напряму в Cliniccards — тільки сюди.
 */

import type {
  Booking,
  BookingRequest,
  Category,
  Service,
  Slot,
  Specialist,
} from "@/domain/types";

export interface SpecialistWithAvailability extends Specialist {
  nearestFreeDate: string | null;
}

export interface ServicesResponse {
  categories: Category[];
  services: Service[];
}

export interface AvailabilityResponse {
  serviceIds: string[];
  durationMin: number;
  range: { from: string; to: string };
  slots: Slot[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Помилка запиту (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSpecialists(): Promise<SpecialistWithAvailability[]> {
  const data = await getJson<{ specialists: SpecialistWithAvailability[] }>("/api/specialists");
  return data.specialists;
}

export async function fetchServices(): Promise<ServicesResponse> {
  return getJson<ServicesResponse>("/api/services");
}

export async function fetchAvailability(params: {
  serviceIds: string[];
  from: string;
  to: string;
  specialistId?: string;
}): Promise<AvailabilityResponse> {
  const qs = new URLSearchParams({
    serviceIds: params.serviceIds.join(","),
    from: params.from,
    to: params.to,
  });
  if (params.specialistId) qs.set("specialistId", params.specialistId);
  return getJson<AvailabilityResponse>(`/api/availability?${qs.toString()}`);
}

export async function createBooking(
  request: BookingRequest,
  idempotencyKey: string,
): Promise<Booking> {
  const res = await fetch("/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(request),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Не вдалося створити запис (${res.status}).`);
  }
  return body.booking as Booking;
}
