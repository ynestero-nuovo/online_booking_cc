/**
 * Каталог для Cliniccards-провайдера.
 *
 * Спільний каталог уже містить РЕАЛЬНІ `doctor_id` у `Service.specialistIds`
 * (джерело — `price-items.json`), тож тут жодного мапінгу не потрібно — лише ре-експорт.
 */

import { CATALOG_CATEGORIES, CATALOG_SERVICES, catalogDurationMin } from "../catalog";

export const CLINICCARDS_CATEGORIES = CATALOG_CATEGORIES;
export const CLINICCARDS_SERVICES = CATALOG_SERVICES;

/** Тривалість послуги (хв) за id; для обчислення time_end при створенні візиту. */
export const serviceDurationMin = catalogDurationMin;
