/**
 * Локальний каталог послуг і категорій для Cliniccards-провайдера.
 *
 * У Cliniccards API НЕМАЄ ендпоінтів для послуг/категорій, тож каталог тримаємо тут
 * і версіонуємо в git. `specialistIds` мають збігатися з реальними `doctor_id` з
 * `GET /schedule-shifts` (див. mapper). Тривалість/ціну/категорії задає власник.
 *
 * TODO(власник): замінити приклади `doctor_id` нижче на реальні з Cliniccards.
 */

import type { Category, Service } from "@/domain/types";

export const CLINICCARDS_CATEGORIES: Category[] = [
  { id: "cat-top", name: "Топ-послуги", order: 0 },
  { id: "cat-mani", name: "Манікюр", order: 1 },
  { id: "cat-pedi", name: "Педикюр", order: 2 },
];

export const CLINICCARDS_SERVICES: Service[] = [
  {
    id: "svc-mani-classic",
    name: "Класичний манікюр",
    categoryId: "cat-mani",
    durationMin: 60,
    price: 350,
    specialistIds: ["DOCTOR_ID_1"],
  },
  {
    id: "svc-mani-gel",
    name: "Манікюр + гель-лак",
    categoryId: "cat-mani",
    durationMin: 90,
    price: 500,
    specialistIds: ["DOCTOR_ID_1", "DOCTOR_ID_2"],
  },
  {
    id: "svc-mani-top",
    name: "Манікюр у топмайстра",
    categoryId: "cat-top",
    durationMin: 90,
    price: 700,
    specialistIds: ["DOCTOR_ID_2"],
  },
  {
    id: "svc-pedi-spa",
    name: "SPA-педикюр",
    categoryId: "cat-pedi",
    durationMin: 120,
    price: 800,
    specialistIds: ["DOCTOR_ID_3"],
  },
];

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export function serviceDurationMin(serviceId: string): number | undefined {
  return CLINICCARDS_SERVICES.find((s) => s.id === serviceId)?.durationMin;
}
