import { NextResponse } from "next/server";
import { getServicesWithCategories } from "@/server/booking-service";

export async function GET() {
  const { categories, services } = await getServicesWithCategories();
  return NextResponse.json({ categories, services });
}
