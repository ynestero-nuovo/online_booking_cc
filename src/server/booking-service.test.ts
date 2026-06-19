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

const SERVICE_ID = "svc-mani-classic";

describe("getServicesWithCategories", () => {
  it("повертає категорії у порядку order", async () => {
    const { categories } = await getServicesWithCategories();
    const orders = categories.map((c) => c.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("getAvailability", () => {
  it("повертає згруповані слоти для послуги", async () => {
    const result = await getAvailability({ serviceId: SERVICE_ID, range: next7Days() });
    expect(result.durationMin).toBe(60);
    expect(result.slots.length).toBeGreaterThan(0);
    const regrouped =
      result.groups.morning.length +
      result.groups.afternoon.length +
      result.groups.evening.length;
    expect(regrouped).toBe(result.slots.length);
  });

  it("404 для невідомої послуги", async () => {
    await expect(
      getAvailability({ serviceId: "svc-none", range: next7Days() }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("createBooking", () => {
  it("створює запис на вільний слот, повертає 409 при повторі, поважає Idempotency-Key", async () => {
    const { slots } = await getAvailability({ serviceId: SERVICE_ID, range: next7Days() });
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
    const fresh = await getAvailability({ serviceId: SERVICE_ID, range: next7Days() });
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
});
