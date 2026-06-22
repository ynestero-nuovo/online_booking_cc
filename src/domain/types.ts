/**
 * Доменні типи онлайн-запису.
 *
 * Чистий шар: без залежностей і без логіки. Усі моменти часу — ISO-рядки в UTC
 * (напр. "2026-06-19T08:30:00.000Z"). Дати без часу — ISO-дата "YYYY-MM-DD".
 */

/** Момент часу як ISO-8601 рядок в UTC. */
export type IsoDateTime = string;

/** Календарна дата як ISO-рядок "YYYY-MM-DD". */
export type IsoDate = string;

/** Спеціаліст салону (майстер, топмайстер тощо). */
export interface Specialist {
  id: string;
  name: string;
  /** Коротке відображуване ім'я / нік. */
  alias: string;
  /** Роль або позиція (напр. "Лікар", "Косметолог"). */
  role: string;
  /** URL фото (з /public). Необов'язкове — інакше показуємо ініціали. */
  photoUrl?: string;
}

/** Категорія послуг для групування у списку. */
export interface Category {
  id: string;
  name: string;
  /** Порядок відображення (менше = вище). */
  order: number;
}

/** Послуга, яку можна забронювати. */
export interface Service {
  id: string;
  name: string;
  categoryId: string;
  /** Тривалість послуги у хвилинах. */
  durationMin: number;
  /** Ціна (у мінімальних одиницях валюти або як домовлено з CRM). */
  price: number;
  /** Спеціалісти, що надають цю послугу. */
  specialistIds: string[];
}

/** Робоча зміна спеціаліста на конкретну дату. */
export interface Shift {
  specialistId: string;
  date: IsoDate;
  startTime: IsoDateTime;
  endTime: IsoDateTime;
}

/** Зайнятий інтервал спеціаліста (візити + резерви разом). */
export interface Busy {
  specialistId: string;
  startTime: IsoDateTime;
  endTime: IsoDateTime;
}

/** Вільний слот для запису. */
export interface Slot {
  specialistId: string;
  startTime: IsoDateTime;
  endTime: IsoDateTime;
}

/** Група часу протягом дня. */
export type TimeGroup = "morning" | "afternoon" | "evening";

/** Слоти, згруповані за частиною дня. */
export type GroupedSlots = Record<TimeGroup, Slot[]>;

/** Дані пацієнта, що бронює запис. */
export interface Patient {
  name: string;
  phone: string;
}

/** Запит на створення запису. */
export interface BookingRequest {
  specialistId: string;
  serviceIds: string[];
  startTime: IsoDateTime;
  patient: Patient;
  comment?: string;
}

/** Статус запису. */
export type BookingStatus = "pending" | "confirmed" | "cancelled";

/** Створений запис. */
export interface Booking extends BookingRequest {
  id: string;
  status: BookingStatus;
}
