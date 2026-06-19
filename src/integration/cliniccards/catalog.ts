/**
 * Каталог послуг/категорій для Cliniccards-провайдера.
 *
 * У Cliniccards API НЕМАЄ ендпоінтів послуг/категорій → беремо спільний каталог
 * (`src/integration/catalog.ts`, згенерований із прайсу) і додаємо прив'язку до
 * реальних `doctor_id`.
 */

import type { Category, Service } from "@/domain/types";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, catalogDurationMin } from "../catalog";

/**
 * Реальні doctor_id з `/schedule-shifts` (звірено наживо):
 * 79215 Ковбаса Катерина (головний лікар), 79264 Самоукова Вікторія,
 * 79716 Кашицька Ольга, 94758 Мовчан Тетяна, 88387 Калашнік Катерина (косметолог).
 */
const ALL_DOCTORS = ["79215", "79264", "79716", "94758", "88387"];

/** Перевизначення «послуга → doctor_id». Поки порожня → діє дефолт ALL_DOCTORS. */
const SERVICE_DOCTORS: Record<string, string[]> = {
  // "svc-0": ["79215"],
};

export const CLINICCARDS_CATEGORIES: Category[] = CATALOG_CATEGORIES;

// Поки «всі роблять усе» → кожна послуга прив'язана до всіх реальних лікарів.
export const CLINICCARDS_SERVICES: Service[] = CATALOG_SERVICES.map((s) => ({
  ...s,
  specialistIds: SERVICE_DOCTORS[s.id] ?? ALL_DOCTORS,
}));

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export function serviceDurationMin(serviceId: string): number | undefined {
  return catalogDurationMin(serviceId);
}
