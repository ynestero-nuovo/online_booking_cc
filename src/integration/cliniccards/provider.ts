/**
 * CliniccardsProvider — реалізація BookingProvider поверх реального API.
 *
 * Послуги/категорії беруться з локального каталогу (в API їх немає). Спеціалісти
 * виводяться зі змін. Час конвертується Kyiv↔UTC. Контракт /api незмінний.
 */

import type {
  Booking,
  BookingRequest,
  BookingStatus,
  Category,
  Service,
  Shift,
  Specialist,
} from "@/domain/types";
import { addDaysIso, todayIsoDate } from "@/lib/date";
import { digitsOnly } from "@/lib/phone";
import type { BookingProvider, DateRange } from "../ports";
import { CliniccardsClient, type CliniccardsClientOptions } from "./client";
import { CLINICCARDS_CATEGORIES, CLINICCARDS_SERVICES, serviceDurationMin } from "./catalog";
import { buildVisitNote, deriveSpecialists, shiftToDomain, spacesToBusy, visitToBusy } from "./mapper";
import { utcIsoToKyivParts } from "./timezone";

/** Вікно (днів), у якому збираємо унікальних спеціалістів зі змін. */
const SPECIALIST_WINDOW_DAYS = 60;
/** Статус, з яким створюємо онлайн-запис. */
const ONLINE_BOOKING_STATUS = "BOOKING";

function roundTo5(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const rounded = Math.round(m / 5) * 5;
  const carry = rounded === 60;
  const hh = String(h + (carry ? 1 : 0)).padStart(2, "0");
  const mm = String(carry ? 0 : rounded).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapStatus(raw: string): BookingStatus {
  switch (raw) {
    case "CANCELLED":
      return "cancelled";
    case "CONFIRMED":
    case "VISITED":
    case "IN_CLINIC":
    case "IN_CHAIR":
      return "confirmed";
    default:
      return "pending";
  }
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
  }
  return { firstname: parts[0] || "Клієнт", lastname: parts[0] || "Клієнт" };
}

export function createCliniccardsProvider(opts: CliniccardsClientOptions): BookingProvider {
  const client = new CliniccardsClient(opts);

  /** Зміни в межах діапазону (розширюємо запит ±1 день під межі таймзони). */
  async function loadShiftsInRange(range: DateRange): Promise<Shift[]> {
    const raw = await client.getShifts(addDaysIso(range.from, -1), addDaysIso(range.to, 1));
    return raw
      .map(shiftToDomain)
      .filter((s) => s.date >= range.from && s.date <= range.to);
  }

  return {
    async getSpecialists(): Promise<Specialist[]> {
      const from = todayIsoDate();
      const raw = await client.getShifts(from, addDaysIso(from, SPECIALIST_WINDOW_DAYS));
      return deriveSpecialists(raw);
    },

    async getCategories(): Promise<Category[]> {
      return CLINICCARDS_CATEGORIES;
    },

    async getServices(): Promise<Service[]> {
      return CLINICCARDS_SERVICES;
    },

    getShifts(range: DateRange): Promise<Shift[]> {
      return loadShiftsInRange(range);
    },

    async getBusy(range: DateRange) {
      const from = addDaysIso(range.from, -1);
      const to = addDaysIso(range.to, 1);
      const [visits, spaces, shifts] = await Promise.all([
        client.getVisits(from, to),
        client.getSpaces(from, to),
        client.getShifts(from, to),
      ]);
      const fromVisits = visits.map(visitToBusy).filter((b): b is NonNullable<typeof b> => b !== null);
      const fromSpaces = spacesToBusy(spaces, shifts);
      return [...fromVisits, ...fromSpaces];
    },

    async createBooking(request: BookingRequest): Promise<Booking> {
      // Кілька послуг в одному візиті → сумарна тривалість.
      let duration = 0;
      for (const id of request.serviceIds) {
        const d = serviceDurationMin(id);
        if (d === undefined) throw new Error(`Невідома послуга у каталозі: ${id}`);
        duration += d;
      }

      // 1. Пацієнт: знайти за телефоном (нормалізованим) або створити.
      const phone = digitsOnly(request.patient.phone);
      const found = phone ? await client.findPatientByPhone(phone) : [];
      let patientId = found[0]?.patient_id;
      if (!patientId) {
        const { firstname, lastname } = splitName(request.patient.name);
        const created = await client.createPatient({ firstname, lastname, phone });
        patientId = created.patient_id;
      }

      // 2. Кабінет: беремо зі зміни лікаря на цю дату.
      const start = utcIsoToKyivParts(request.startTime);
      const dayShifts = await client.getShifts(start.date, start.date);
      const shift = dayShifts.find((s) => s.doctor_id === request.specialistId);
      if (!shift) {
        throw new Error("Немає зміни лікаря на обрану дату — не можемо визначити кабінет.");
      }

      // 3. Час кінця візиту.
      const endIso = new Date(Date.parse(request.startTime) + duration * 60_000).toISOString();
      const end = utcIsoToKyivParts(endIso);

      // 4. Нотатка: стандартний перший рядок «З онлайн запису», далі назви обраних
      //    послуг (кожна з нового рядка), коментар клієнта — останнім.
      const serviceNames = request.serviceIds
        .map((id) => CLINICCARDS_SERVICES.find((s) => s.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      const note = buildVisitNote(serviceNames, request.comment);

      // 5. Створення візиту.
      const createdVisit = await client.createVisit({
        status: ONLINE_BOOKING_STATUS,
        patient_id: patientId,
        cabinet_id: shift.schedule_cabinets_id,
        doctor_id: request.specialistId,
        note,
        date: start.date,
        time_start: roundTo5(start.time),
        time_end: roundTo5(end.time),
      });

      return {
        ...request,
        id: createdVisit.visit_id,
        status: mapStatus(createdVisit.status),
      };
    },
  };
}
