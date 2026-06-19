/**
 * Конвертація часу Cliniccards (київський «настінний» час) ↔ UTC.
 * Реалізація — у спільному `@/lib/timezone`; тут лише ре-експорт для адаптера.
 */
export { kyivWallToUtcIso, utcIsoToKyivParts } from "@/lib/timezone";
