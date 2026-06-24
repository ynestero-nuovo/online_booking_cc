/**
 * Спільний мапер каталогу → доменні `Service` для будь-якого провайдера.
 *
 * Каталог зберігає ключі лікарів (`DoctorKey`), кожен провайдер підставляє свої
 * id спеціалістів. Mock → `sp-*`, Cliniccards → реальні `doctor_id`.
 */

import type { Service } from "@/domain/types";
import { CATALOG_SERVICES, type DoctorKey } from "./catalog";

/** Будує список `Service`, замінюючи ключі лікарів на id конкретного провайдера. */
export function catalogToServices(idByKey: Record<DoctorKey, string>): Service[] {
  return CATALOG_SERVICES.map((s) => ({
    id: s.id,
    name: s.name,
    categoryId: s.categoryId,
    durationMin: s.durationMin,
    price: s.price,
    specialistIds: s.providers.map((k) => idByKey[k]),
  }));
}
