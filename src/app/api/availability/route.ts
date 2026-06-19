import { NextRequest, NextResponse } from "next/server";
import { getAvailability, HttpError } from "@/server/booking-service";
import { availabilityQuerySchema } from "@/server/schemas";
import type { DateRange } from "@/integration/ports";

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = availabilityQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні параметри запиту.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const q = parsed.data;
  const range: DateRange = q.date
    ? { from: q.date, to: q.date }
    : { from: q.from!, to: q.to! };

  try {
    const result = await getAvailability({
      serviceIds: q.serviceIds,
      specialistId: q.specialistId,
      range,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
