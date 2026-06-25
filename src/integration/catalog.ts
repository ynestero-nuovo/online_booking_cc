/**
 * Каталог послуг/категорій. Джерело правди — `price-items.json` (експорт із Cliniccards
 * з РЕАЛЬНИМИ id послуг/категорій/лікарів). Замінив старий xlsx-пайплайн.
 *
 * - `Service.id` / `Category.id` — реальні id Cliniccards (напр. "1655815" / "137160").
 * - `Service.specialistIds` — реальні `doctor_id` (ключі `items`); ті самі id, що віддає
 *   `/schedule-shifts`, тож і mock, і Cliniccards використовують каталог БЕЗ мапінгу.
 * - `durationMin` — тривалість послуги; якщо у різних лікарів вона різна (рідко, 2 позиції),
 *   беремо максимум (безпечно для резервування часу).
 * - `Category.order` — порядок у довіднику категорій.
 */

import type { Category, Service } from "@/domain/types";
import priceItems from "./price-items.json";

interface RawPriceItem {
  id: string;
  name: string;
  group_id: string;
  price: string;
  /** doctor_id → тривалість у хвилинах. */
  items: Record<string, number>;
}
interface PriceItemsFile {
  /** doctor_id → ім'я (довідка; імена спеціалістів беремо зі staff.ts / CRM, не звідси). */
  "_довідка_фахівці": Record<string, string>;
  "_довідка_категорії": Record<string, string>;
  priceItems: RawPriceItem[];
}

const data = priceItems as unknown as PriceItemsFile;

export const CATALOG_CATEGORIES: Category[] = Object.entries(data["_довідка_категорії"]).map(
  ([id, name], order) => ({ id, name, order }),
);

export const CATALOG_SERVICES: Service[] = data.priceItems.map((it) => ({
  id: it.id,
  name: it.name,
  categoryId: it.group_id,
  durationMin: Math.max(...Object.values(it.items)),
  price: Number(it.price),
  specialistIds: Object.keys(it.items),
}));

const durationById = new Map(CATALOG_SERVICES.map((s) => [s.id, s.durationMin]));

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export function catalogDurationMin(serviceId: string): number | undefined {
  return durationById.get(serviceId);
}
