import { describe, expect, it } from "vitest";
import { deriveSpecialists, shiftToDomain, spacesToBusy, visitToBusy } from "./mapper";
import type { RawShift, RawSpace, RawVisit } from "./client";

const shift = (over: Partial<RawShift> = {}): RawShift => ({
  schedule_shift_id: "sh1",
  doctor_id: "d1",
  doctor: "Анна",
  shift_start: "2024-07-01 09:00:00",
  shift_end: "2024-07-01 18:00:00",
  schedule_cabinets_id: "c1",
  ...over,
});

describe("shiftToDomain", () => {
  it("конвертує київський час у UTC і виводить дату", () => {
    const s = shiftToDomain(shift());
    expect(s.specialistId).toBe("d1");
    expect(s.date).toBe("2024-07-01");
    expect(s.startTime).toBe("2024-07-01T06:00:00.000Z"); // 09:00 Kyiv (літо, +3)
    expect(s.endTime).toBe("2024-07-01T15:00:00.000Z");
  });
});

describe("deriveSpecialists", () => {
  it("повертає унікальних лікарів за doctor_id", () => {
    const specs = deriveSpecialists([
      shift({ doctor_id: "d1", doctor: "Анна" }),
      shift({ doctor_id: "d1", doctor: "Анна" }),
      shift({ doctor_id: "d2", doctor: "Ольга" }),
    ]);
    expect(specs.map((s) => s.id)).toEqual(["d1", "d2"]);
    expect(specs[0].alias).toBe("Анна");
  });
});

describe("visitToBusy", () => {
  it("мапить активний візит у Busy (UTC)", () => {
    const raw: RawVisit = {
      visit_id: "v1",
      doctor_id: "d1",
      visit_start: "2024-07-01 10:00:00",
      visit_end: "2024-07-01 11:00:00",
      status: "PLANNED",
    };
    expect(visitToBusy(raw)).toEqual({
      specialistId: "d1",
      startTime: "2024-07-01T07:00:00.000Z",
      endTime: "2024-07-01T08:00:00.000Z",
    });
  });

  it("ігнорує скасований візит", () => {
    const raw: RawVisit = {
      visit_id: "v2",
      doctor_id: "d1",
      visit_start: "2024-07-01 10:00:00",
      visit_end: "2024-07-01 11:00:00",
      status: "CANCELLED",
    };
    expect(visitToBusy(raw)).toBeNull();
  });
});

describe("spacesToBusy", () => {
  const space = (over: Partial<RawSpace> = {}): RawSpace => ({
    schedule_space_id: "sp1",
    space_start: "2024-07-01 13:00:00",
    space_end: "2024-07-01 14:00:00",
    schedule_cabinets_id: "c1",
    ...over,
  });

  it("блокує лікаря, чия зміна перетинає резерв у тому ж кабінеті", () => {
    const busy = spacesToBusy([space()], [shift({ doctor_id: "d1", schedule_cabinets_id: "c1" })]);
    expect(busy).toHaveLength(1);
    expect(busy[0].specialistId).toBe("d1");
    expect(busy[0].startTime).toBe("2024-07-01T10:00:00.000Z");
  });

  it("не блокує лікаря з іншого кабінету", () => {
    const busy = spacesToBusy([space({ schedule_cabinets_id: "c1" })], [
      shift({ doctor_id: "d2", schedule_cabinets_id: "c2" }),
    ]);
    expect(busy).toHaveLength(0);
  });
});
