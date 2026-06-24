/**
 * HTTP-клієнт Cliniccards. ТІЛЬКИ СЕРВЕР: використовує секретний ключ із env.
 *
 * Авторизація — заголовок `Token`. Усі відповіді мають конверт
 * `{ data, result: "success"|"fail", error }`; на `fail` кидаємо помилку.
 * `data` валідуємо zod-схемами (нижче) — обов'язкові лише поля, які ми реально
 * читаємо; зайві поля ігноруються. Так некоректну відповідь ловимо на межі,
 * а не падаємо десь у мапері. Типи `Raw*` виводяться зі схем (немає дрейфу).
 */

import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("Cliniccards client є серверним модулем і не може імпортуватися в клієнті.");
}

/** Зміна лікаря. Обов'язкові лише поля, які ми читаємо. */
export const rawShiftSchema = z.object({
  doctor_id: z.string(),
  doctor: z.string(),
  shift_start: z.string(),
  shift_end: z.string(),
  schedule_cabinets_id: z.string(),
  schedule_shift_id: z.string().optional(),
  schedule_cabinet_name: z.string().optional(),
});
export type RawShift = z.infer<typeof rawShiftSchema>;

/** Резерв кабінету (schedule-space). */
export const rawSpaceSchema = z.object({
  space_start: z.string(),
  space_end: z.string(),
  schedule_cabinets_id: z.string().optional(),
  schedule_space_id: z.string().optional(),
  type: z.string().optional(),
});
export type RawSpace = z.infer<typeof rawSpaceSchema>;

/** Візит (для розрахунку зайнятості). */
export const rawVisitSchema = z.object({
  doctor_id: z.string(),
  visit_start: z.string(),
  visit_end: z.string(),
  status: z.string(),
  visit_id: z.string().optional(),
});
export type RawVisit = z.infer<typeof rawVisitSchema>;

/** Пацієнт (пошук/створення). */
export const rawPatientSchema = z.object({
  patient_id: z.string(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
});
export type RawPatient = z.infer<typeof rawPatientSchema>;

/** Створений візит. */
export const rawCreatedVisitSchema = z.object({
  visit_id: z.string(),
  status: z.string(),
  patient_id: z.string().optional(),
  doctor_id: z.string().optional(),
  visit_start: z.string().optional(),
  visit_end: z.string().optional(),
  note: z.string().optional(),
});
export type RawCreatedVisit = z.infer<typeof rawCreatedVisitSchema>;

export interface CreateVisitBody {
  status: string;
  patient_id: string;
  cabinet_id: string;
  doctor_id: string;
  note: string;
  date: string; // YYYY-MM-DD
  time_start: string; // HH:MM (кратно 5)
  time_end: string; // HH:MM (кратно 5)
}

export interface CliniccardsClientOptions {
  apiKey: string;
  baseUrl: string;
}

export class CliniccardsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: CliniccardsClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: { method?: string; query?: Record<string, string>; body?: unknown },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
    }

    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Token: this.apiKey,
        "Content-Type": "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Cliniccards ${path}: HTTP ${res.status}`);
    }

    const json = (await res.json()) as { data?: unknown; result?: string; error?: string | null };
    if (json.result !== "success") {
      throw new Error(`Cliniccards ${path}: ${json.error ?? "невідома помилка"}`);
    }

    const parsed = schema.safeParse(json.data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.join(".") || "data";
      throw new Error(`Cliniccards ${path}: неочікувана форма відповіді (${where}: ${issue?.message ?? "validation"})`);
    }
    return parsed.data;
  }

  getShifts(from: string, to: string): Promise<RawShift[]> {
    return this.request("/schedule-shifts", z.array(rawShiftSchema), { query: { from, to } });
  }

  getSpaces(from: string, to: string): Promise<RawSpace[]> {
    return this.request("/schedule-spaces", z.array(rawSpaceSchema), { query: { from, to } });
  }

  getVisits(from: string, to: string): Promise<RawVisit[]> {
    return this.request("/visits", z.array(rawVisitSchema), { query: { from, to } });
  }

  findPatientByPhone(phone: string): Promise<RawPatient[]> {
    return this.request("/patients", z.array(rawPatientSchema), { query: { phone } });
  }

  createPatient(body: { firstname: string; lastname: string; phone: string }): Promise<RawPatient> {
    return this.request("/patients", rawPatientSchema, { method: "POST", body });
  }

  createVisit(body: CreateVisitBody): Promise<RawCreatedVisit> {
    return this.request("/visits", rawCreatedVisitSchema, { method: "POST", body });
  }
}
