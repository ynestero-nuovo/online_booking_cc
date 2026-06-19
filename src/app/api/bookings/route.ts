import { NextRequest, NextResponse } from "next/server";
import { createBooking, HttpError } from "@/server/booking-service";
import { bookingRequestSchema } from "@/server/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Очікується JSON-тіло." }, { status: 400 });
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані запису.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;

  try {
    const booking = await createBooking(parsed.data, idempotencyKey);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
