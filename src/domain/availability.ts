/**
 * Чиста логіка доступності.
 *
 * Вільні слоти = зміни спеціаліста − (візити + резерви), нарізані на крок (`stepMin`)
 * під тривалість послуги (`durationMin`). Слот валідний, лише якщо послуга влазить до
 * кінця зміни і не перетинається з жодним зайнятим інтервалом. Дотик на межі
 * (кінець одного = початок іншого) перетином НЕ вважається. Час — ISO/UTC.
 *
 * Без залежностей від інших шарів.
 */

import type { Busy, Service, Shift, Slot } from "./types";

const MS_PER_MIN = 60_000;

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Чи перетинаються [aStart, aEnd) та [bStart, bEnd)? Дотик на межі — не перетин. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Обчислює вільні слоти ОДНОГО спеціаліста.
 *
 * Перебирає всі зміни (відфільтрувати за спеціалістом має викликач за потреби),
 * крокує від початку зміни з кроком `stepMin`, відкидає слоти, що виходять за зміну
 * або перетинаються із зайнятістю. Результат відсортований за часом початку.
 */
export function computeFreeSlots(
  shifts: Shift[],
  busy: Busy[],
  durationMin: number,
  stepMin: number,
): Slot[] {
  if (durationMin <= 0 || stepMin <= 0) return [];

  const durationMs = durationMin * MS_PER_MIN;
  const stepMs = stepMin * MS_PER_MIN;
  const slots: Slot[] = [];

  for (const shift of shifts) {
    const shiftStart = toMs(shift.startTime);
    const shiftEnd = toMs(shift.endTime);
    const relevantBusy = busy.filter((b) => b.specialistId === shift.specialistId);

    for (let start = shiftStart; start + durationMs <= shiftEnd; start += stepMs) {
      const end = start + durationMs;
      const blocked = relevantBusy.some((b) =>
        overlaps(start, end, toMs(b.startTime), toMs(b.endTime)),
      );
      if (blocked) continue;
      slots.push({
        specialistId: shift.specialistId,
        startTime: toIso(start),
        endTime: toIso(end),
      });
    }
  }

  slots.sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
  return slots;
}

/**
 * Вільні слоти для послуги через кількох спеціалістів (режими «по послузі» та
 * «будь-який фахівець»). Розглядає лише зміни/зайнятість указаних `specialistIds`,
 * об'єднує результати й сортує за часом початку.
 */
export function computeFreeSlotsForService(
  shifts: Shift[],
  busy: Busy[],
  specialistIds: string[],
  durationMin: number,
  stepMin: number,
): Slot[] {
  const allowed = new Set(specialistIds);
  const relevantShifts = shifts.filter((s) => allowed.has(s.specialistId));
  const relevantBusy = busy.filter((b) => allowed.has(b.specialistId));
  return computeFreeSlots(relevantShifts, relevantBusy, durationMin, stepMin);
}

/**
 * Спеціалісти, які надають УСІ задані послуги (перетин їхніх `specialistIds`).
 * Порожній список послуг → порожній перетин. Використовують і BFF, і UI.
 */
export function commonSpecialistIds(services: Service[]): string[] {
  if (services.length === 0) return [];
  const sets = services.map((s) => new Set(s.specialistIds));
  return [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
}
