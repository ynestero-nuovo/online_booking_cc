/**
 * Каталог послуг/категорій для Cliniccards-провайдера.
 *
 * У Cliniccards API НЕМАЄ ендпоінтів послуг/категорій → беремо спільний каталог
 * (`src/integration/catalog.ts`, згенерований із прайсу) і додаємо прив'язку до
 * реальних `doctor_id`.
 *
 * TODO(власник): заповнити `SERVICE_DOCTORS` реальними `doctor_id` з `/schedule-shifts`.
 * Поки мапи немає, послуги не матимуть спеціалістів → у режимі «по послузі» слотів не буде.
 */

import type { Category, Service } from "@/domain/types";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, catalogDurationMin } from "../catalog";

/** Мапа: serviceId → реальні doctor_id, що надають послугу. Поки порожня. */
const SERVICE_DOCTORS: Record<string, string[]> = {
  // "svc-0": ["<doctor_id>"],
};

export const CLINICCARDS_CATEGORIES: Category[] = CATALOG_CATEGORIES;

export const CLINICCARDS_SERVICES: Service[] = CATALOG_SERVICES.map((s) => ({
  ...s,
  specialistIds: SERVICE_DOCTORS[s.id] ?? [],
}));

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export function serviceDurationMin(serviceId: string): number | undefined {
  return catalogDurationMin(serviceId);
}
