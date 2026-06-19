/**
 * Мапінг сирих відповідей Cliniccards → доменні типи. Чисті функції.
 *
 * Особливості Cliniccards:
 * - окремого ендпоінта спеціалістів немає → виводимо їх з унікальних doctor_id у змінах;
 * - schedule-spaces (резерви) прив'язані до кабінету, не до лікаря → резолвимо лікаря
 *   через зміни в тому ж кабінеті, що перетинаються за часом;
 * - час «настінний» Europe/Kyiv → конвертуємо в UTC.
 */

import type { Busy, Shift, Specialist } from "@/domain/types";
import { kyivWallToUtcIso, utcIsoToKyivParts } from "./timezone";
import type { RawShift, RawSpace, RawVisit } from "./client";

/** Статуси візитів, що НЕ блокують час (слот лишається вільним). */
const NON_BLOCKING_STATUSES = new Set(["CANCELLED"]);

export function shiftToDomain(raw: RawShift): Shift {
  const startTime = kyivWallToUtcIso(raw.shift_start);
  return {
    specialistId: raw.doctor_id,
    date: utcIsoToKyivParts(startTime).date,
    startTime,
    endTime: kyivWallToUtcIso(raw.shift_end),
  };
}

export function deriveSpecialists(shifts: RawShift[]): Specialist[] {
  const seen = new Map<string, Specialist>();
  for (const s of shifts) {
    if (seen.has(s.doctor_id)) continue;
    seen.set(s.doctor_id, {
      id: s.doctor_id,
      name: s.doctor,
      alias: s.doctor,
      role: "",
    });
  }
  return [...seen.values()];
}

export function visitToBusy(raw: RawVisit): Busy | null {
  if (NON_BLOCKING_STATUSES.has(raw.status)) return null;
  return {
    specialistId: raw.doctor_id,
    startTime: kyivWallToUtcIso(raw.visit_start),
    endTime: kyivWallToUtcIso(raw.visit_end),
  };
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Резерви кабінетів → Busy для лікарів. Для кожного резерву знаходимо зміни в тому ж
 * кабінеті, що перетинаються за часом, і блокуємо відповідних лікарів.
 */
export function spacesToBusy(spaces: RawSpace[], shifts: RawShift[]): Busy[] {
  const result: Busy[] = [];
  for (const space of spaces) {
    const start = kyivWallToUtcIso(space.space_start);
    const end = kyivWallToUtcIso(space.space_end);
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);

    for (const shift of shifts) {
      if (space.schedule_cabinets_id && shift.schedule_cabinets_id !== space.schedule_cabinets_id) {
        continue;
      }
      const shiftStart = Date.parse(kyivWallToUtcIso(shift.shift_start));
      const shiftEnd = Date.parse(kyivWallToUtcIso(shift.shift_end));
      if (overlaps(startMs, endMs, shiftStart, shiftEnd)) {
        result.push({ specialistId: shift.doctor_id, startTime: start, endTime: end });
      }
    }
  }
  return result;
}
