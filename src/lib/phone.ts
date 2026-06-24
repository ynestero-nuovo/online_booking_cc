/**
 * Хелпери для телефонів. Чистий модуль — використовують і сервер (валідація,
 * Cliniccards-адаптер), і клієнт (форма вводу).
 */

/** Лишає лише цифри: Cliniccards шукає/зберігає телефон без не-цифрових символів. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
