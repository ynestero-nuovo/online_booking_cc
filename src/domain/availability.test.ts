import { describe, expect, it } from "vitest";
import {
  commonSpecialistIds,
  computeFreeSlots,
  computeFreeSlotsForService,
} from "./availability";
import type { Busy, Service, Shift } from "./types";

/** Хелпер: ISO-datetime для дати "2026-06-22" + година UTC (дробові години ок). */
function at(hour: number, minute = 0): string {
  const ms = Date.UTC(2026, 5, 22) + (hour * 60 + minute) * 60_000;
  return new Date(ms).toISOString();
}

function shift(start: number, end: number, specialistId = "sp-1"): Shift {
  return {
    specialistId,
    date: "2026-06-22",
    startTime: at(start),
    endTime: at(end),
  };
}

function busy(start: number, end: number, specialistId = "sp-1"): Busy {
  return { specialistId, startTime: at(start), endTime: at(end) };
}

describe("computeFreeSlots", () => {
  it("повертає порожньо для порожньої зміни", () => {
    expect(computeFreeSlots([], [], 60, 60)).toEqual([]);
  });

  it("нарізає вільну зміну на слоти за кроком", () => {
    // Зміна 09:00–12:00, послуга 60 хв, крок 60 хв → 09:00, 10:00, 11:00.
    const slots = computeFreeSlots([shift(9, 12)], [], 60, 60);
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(10), at(11)]);
    expect(slots[slots.length - 1].endTime).toBe(at(12));
  });

  it("включає слот, що закінчується рівно в кінці зміни", () => {
    // Зміна 09:00–10:00, послуга 60 хв → рівно один слот 09:00–10:00.
    const slots = computeFreeSlots([shift(9, 10)], [], 60, 60);
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe(at(9));
    expect(slots[0].endTime).toBe(at(10));
  });

  it("відкидає слот, що не влазить до кінця зміни", () => {
    // Зміна 09:00–09:90(10:30), послуга 60 хв, крок 30 → 09:00 ок, 09:30 ні (вийде за 10:30).
    const slots = computeFreeSlots([shift(9, 10.5)], [], 60, 30);
    // 09:00–10:00 ок; 09:30–10:30 ок; 10:00–11:00 ні.
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(9, 30)]);
  });

  it("проміжок коротший за послугу не дає слотів", () => {
    // Зміна 09:00–09:30, послуга 60 хв → жодного слота.
    const slots = computeFreeSlots([shift(9, 9.5)], [], 60, 30);
    expect(slots).toEqual([]);
  });

  it("виключає зайнятий інтервал", () => {
    // Зміна 09:00–12:00, busy 10:00–11:00, послуга 60 хв, крок 60.
    // Вільні: 09:00 (до 10:00 ок), 11:00 (до 12:00 ок). 10:00 перетинається.
    const slots = computeFreeSlots([shift(9, 12)], [busy(10, 11)], 60, 60);
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(11)]);
  });

  it("дотик на межі НЕ вважається перетином", () => {
    // Зміна 09:00–11:00, busy 10:00–11:00, послуга 60 хв, крок 60.
    // Слот 09:00–10:00 торкається busy на 10:00 → дозволено.
    const slots = computeFreeSlots([shift(9, 11)], [busy(10, 11)], 60, 60);
    expect(slots.map((s) => s.startTime)).toEqual([at(9)]);
  });

  it("враховує кілька busy підряд", () => {
    // Зміна 09:00–15:00, busy 10:00–12:00 та 12:00–14:00, послуга 60, крок 60.
    // Вільні: 09:00 (до 10:00), 14:00 (до 15:00).
    const slots = computeFreeSlots(
      [shift(9, 15)],
      [busy(10, 12), busy(12, 14)],
      60,
      60,
    );
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(14)]);
  });

  it("ігнорує busy і зміни іншого спеціаліста", () => {
    const slots = computeFreeSlots(
      [shift(9, 11, "sp-1")],
      [busy(9, 10, "sp-2")],
      60,
      60,
    );
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(10)]);
    expect(slots.every((s) => s.specialistId === "sp-1")).toBe(true);
  });

  it("обробляє кілька змін одного спеціаліста (зранку і ввечері)", () => {
    const slots = computeFreeSlots(
      [shift(9, 10), shift(17, 18)],
      [],
      60,
      60,
    );
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(17)]);
  });

  it("слоти відсортовані за часом початку", () => {
    const slots = computeFreeSlots([shift(17, 18), shift(9, 10)], [], 60, 60);
    expect(slots.map((s) => s.startTime)).toEqual([at(9), at(17)]);
  });
});

describe("computeFreeSlotsForService", () => {
  it("об'єднує слоти кількох спеціалістів (режим «будь-який фахівець»)", () => {
    const shifts: Shift[] = [shift(9, 10, "sp-1"), shift(9, 10, "sp-2")];
    const slots = computeFreeSlotsForService(shifts, [], ["sp-1", "sp-2"], 60, 60);
    expect(slots).toHaveLength(2);
    const ids = slots.map((s) => s.specialistId).sort();
    expect(ids).toEqual(["sp-1", "sp-2"]);
  });

  it("бере лише вказаних спеціалістів", () => {
    const shifts: Shift[] = [shift(9, 10, "sp-1"), shift(9, 10, "sp-3")];
    const slots = computeFreeSlotsForService(shifts, [], ["sp-1"], 60, 60);
    expect(slots.every((s) => s.specialistId === "sp-1")).toBe(true);
  });
});

describe("commonSpecialistIds", () => {
  const svc = (id: string, specialistIds: string[]): Service => ({
    id,
    name: id,
    categoryId: "cat-0",
    durationMin: 60,
    price: 0,
    specialistIds,
  });

  it("повертає порожньо без послуг", () => {
    expect(commonSpecialistIds([])).toEqual([]);
  });

  it("для однієї послуги повертає її спеціалістів", () => {
    expect(commonSpecialistIds([svc("a", ["sp-1", "sp-2"])])).toEqual(["sp-1", "sp-2"]);
  });

  it("повертає перетин спеціалістів кількох послуг", () => {
    const result = commonSpecialistIds([
      svc("a", ["sp-1", "sp-2", "sp-3"]),
      svc("b", ["sp-2", "sp-3"]),
      svc("c", ["sp-3", "sp-2"]),
    ]);
    expect(result.sort()).toEqual(["sp-2", "sp-3"]);
  });

  it("порожній перетин, коли спільних спеціалістів немає", () => {
    expect(commonSpecialistIds([svc("a", ["sp-1"]), svc("b", ["sp-2"])])).toEqual([]);
  });
});
