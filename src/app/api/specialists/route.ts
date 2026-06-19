import { NextResponse } from "next/server";
import { getSpecialistsWithAvailability } from "@/server/booking-service";

export async function GET() {
  const specialists = await getSpecialistsWithAvailability();
  return NextResponse.json({ specialists });
}
