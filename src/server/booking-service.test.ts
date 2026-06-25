import { describe, expect, it } from "vitest";
import {
  createBooking,
  getAvailability,
  getServicesWithCategories,
  HttpError,
} from "./booking-service";
import type { DateRange } from "@/integration/ports";

/** Діапазон на найближчі 7 днів від сьогодні (UTC). */
function next7Days(): DateRange {
  const base = new Date();
  const from = base.toISOString().slice(0, 10);
  const toDate = new Date(base.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { from, to: toDate.toISOString().slice(0, 10) };
}

// Реальні id з price-items.json:
// 1655815 = "Консультація первинна лікаря-дерматолога" (60 хв; лікарі 79264, 79716, 94758).
// 1655820 = "Азелаїново-саліциловий пілінг ОБЛИЧЧЯ Simildiet" (60 хв; усі 5 лікарів, у т.ч. 79264).
const SERVICE_ID = "1655815";
const SERVICE_IDS = [SERVICE_ID];
const DOCTOR_ID = "79264"; // Самоукова — надає обидві послуги вище.

describe("getServicesWithCategories", () => {
  it("повертає категорії у порядку order", async () => {
    const { categories } = await getServicesWithCategories();
    const orders = categories.map((c) => c.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("getAvailability", () => {
  it("повертає слоти для послуги, відсортовані за часом початку", async () => {
    const result = await getAvailability({ serviceIds: SERVICE_IDS, range: next7Days() });
    expect(result.durationMin).toBe(60);
    expect(result.slots.length).toBeGreaterThan(0);
    const starts = result.slots.map((s) => Date.parse(s.startTime));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("сумує тривалість кількох послуг", async () => {
    // 1655815 (60) + 1655820 (60) = 120 хв.
    const result = await getAvailability({
      serviceIds: ["1655815", "1655820"],
      range: next7Days(),
    });
    expect(result.durationMin).toBe(120);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it("режим «будь-який фахівець» не дублює слоти за часом", async () => {
    const result = await getAvailability({ serviceIds: SERVICE_IDS, range: next7Days() });
    const starts = result.slots.map((s) => s.startTime);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("404 для невідомої послуги", async () => {
    await expect(
      getAvailability({ serviceIds: ["no-such-id"], range: next7Days() }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("createBooking", () => {
  it("створює запис на вільний слот, повертає 409 при повторі, поважає Idempotency-Key", async () => {
    const { slots } = await getAvailability({ serviceIds: SERVICE_IDS, range: next7Days() });
    expect(slots.length).toBeGreaterThan(1);

    const slot = slots[0];
    const request = {
      specialistId: slot.specialistId,
      serviceIds: [SERVICE_ID],
      startTime: slot.startTime,
      patient: { name: "Тест", phone: "+380501234567" },
    };

    const booking = await createBooking(request);
    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe("confirmed");

    // Повтор на той самий слот — тепер зайнято → 409.
    await expect(createBooking(request)).rejects.toBeInstanceOf(HttpError);
    await expect(createBooking(request)).rejects.toMatchObject({ status: 409 });

    // Ідемпотентність: беремо гарантовано вільний слот (перерахунок після броні),
    // двічі з тим самим ключем → той самий запис.
    const fresh = await getAvailability({ serviceIds: SERVICE_IDS, range: next7Days() });
    const other = fresh.slots[0];
    const req2 = {
      specialistId: other.specialistId,
      serviceIds: [SERVICE_ID],
      startTime: other.startTime,
      patient: { name: "Тест2", phone: "+380501112233" },
    };
    const a = await createBooking(req2, "key-1");
    const b = await createBooking(req2, "key-1");
    expect(b.id).toBe(a.id);
  });

  it("бронь кількох послуг резервує СУМАРНУ тривалість (не лише першої)", async () => {
    // 1655815 + 1655820 — обидві надає лікар 79264 (60 + 60 = 120 хв).
    const av = await getAvailability({
      serviceIds: ["1655815", "1655820"],
      specialistId: DOCTOR_ID,
      range: next7Days(),
    });
    expect(av.durationMin).toBe(120);
    const slot = av.slots[0];

    await createBooking({
      specialistId: DOCTOR_ID,
      serviceIds: ["1655815", "1655820"],
      startTime: slot.startTime,
      patient: { name: "Тест", phone: "+380501234567" },
    });

    // Початок другої послуги (T+60) має бути заблокований — інакше резерв був лише 60 хв.
    const t60 = new Date(Date.parse(slot.startTime) + 60 * 60_000).toISOString();
    const after = await getAvailability({
      serviceIds: ["1655815"],
      specialistId: DOCTOR_ID,
      range: next7Days(),
    });
    expect(after.slots.some((s) => s.startTime === t60)).toBe(false);
  });
});
