/**
 * Клієнтський доступ до власних BFF-роутів `/api/*`.
 * Фронт НІКОЛИ не ходить напряму в Cliniccards — тільки сюди.
 */

import type {
  Booking,
  BookingRequest,
  Category,
  GroupedSlots,
  Service,
  Slot,
  Specialist,
} from "@/domain/types";

export interface ServicesResponse {
  categories: Category[];
  services: Service[];
}

export interface AvailabilityResponse {
  serviceId: string;
  durationMin: number;
  range: { from: string; to: string };
  slots: Slot[];
  groups: GroupedSlots;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Помилка запиту (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSpecialists(): Promise<Specialist[]> {
  const data = await getJson<{ specialists: Specialist[] }>("/api/specialists");
  return data.specialists;
}

export async function fetchServices(): Promise<ServicesResponse> {
  return getJson<ServicesResponse>("/api/services");
}

export async function fetchAvailability(params: {
  serviceId: string;
  date: string;
  specialistId?: string;
}): Promise<AvailabilityResponse> {
  const qs = new URLSearchParams({ serviceId: params.serviceId, date: params.date });
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
