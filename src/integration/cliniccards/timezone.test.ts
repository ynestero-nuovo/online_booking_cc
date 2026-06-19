import { describe, expect, it } from "vitest";
import { kyivWallToUtcIso, utcIsoToKyivParts } from "./timezone";

describe("kyivWallToUtcIso", () => {
  it("конвертує літній київський час (+03:00)", () => {
    // 1 липня 12:00 у Києві → 09:00 UTC.
    expect(kyivWallToUtcIso("2024-07-01 12:00:00")).toBe("2024-07-01T09:00:00.000Z");
  });

  it("конвертує зимовий київський час (+02:00)", () => {
    // 1 січня 12:00 у Києві → 10:00 UTC.
    expect(kyivWallToUtcIso("2024-01-01 12:00:00")).toBe("2024-01-01T10:00:00.000Z");
  });

  it("приймає роздільник 'T' і відсутні секунди", () => {
    expect(kyivWallToUtcIso("2024-07-01T09:30")).toBe("2024-07-01T06:30:00.000Z");
  });

  it("кидає помилку на некоректному форматі", () => {
    expect(() => kyivWallToUtcIso("notadate")).toThrow();
  });
});

describe("utcIsoToKyivParts", () => {
  it("розкладає UTC на київські дату й час (літо)", () => {
    expect(utcIsoToKyivParts("2024-07-01T09:00:00.000Z")).toEqual({
      date: "2024-07-01",
      time: "12:00",
    });
  });

  it("розкладає UTC на київські дату й час (зима)", () => {
    expect(utcIsoToKyivParts("2024-01-01T10:00:00.000Z")).toEqual({
      date: "2024-01-01",
      time: "12:00",
    });
  });

  it("round-trip wall → utc → parts", () => {
    const utc = kyivWallToUtcIso("2024-09-25 10:30:00");
    expect(utcIsoToKyivParts(utc)).toEqual({ date: "2024-09-25", time: "10:30" });
  });
});
