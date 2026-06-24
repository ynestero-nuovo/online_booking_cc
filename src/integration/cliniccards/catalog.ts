/**
 * Каталог послуг/категорій для Cliniccards-провайдера.
 *
 * У Cliniccards API НЕМАЄ ендпоінтів послуг/категорій → беремо спільний каталог
 * (`src/integration/catalog.ts`, згенерований із прайс-мапи) і маплимо ключі лікарів
 * (`providers`) на реальні `doctor_id`.
 */

import type { Category, Service } from "@/domain/types";
import { CATALOG_CATEGORIES, catalogDurationMin, type DoctorKey } from "../catalog";
import { catalogToServices } from "../catalog-services";

/** Ключ лікаря з каталогу → реальний doctor_id Cliniccards (звірено наживо). */
const DOCTOR_ID: Record<DoctorKey, string> = {
  kovbasa: "79215", // Ковбаса Катерина (головний лікар)
  samoukova: "79264", // Самоукова Вікторія
  kashytska: "79716", // Кашицька Ольга
  movchan: "94758", // Мовчан Тетяна
  kalashnik: "88387", // Калашнік Катерина (косметолог)
};

export const CLINICCARDS_CATEGORIES: Category[] = CATALOG_CATEGORIES;

export const CLINICCARDS_SERVICES: Service[] = catalogToServices(DOCTOR_ID);

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export function serviceDurationMin(serviceId: string): number | undefined {
  return catalogDurationMin(serviceId);
}
