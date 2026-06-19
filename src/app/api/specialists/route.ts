import { NextResponse } from "next/server";
import { getSpecialists } from "@/server/booking-service";

export async function GET() {
  const specialists = await getSpecialists();
  return NextResponse.json({ specialists });
}
