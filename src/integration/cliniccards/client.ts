/**
 * HTTP-клієнт Cliniccards. ТІЛЬКИ СЕРВЕР: використовує секретний ключ із env.
 *
 * Авторизація — заголовок `Token`. Усі відповіді мають конверт
 * `{ data, result: "success"|"fail", error }`; на `fail` кидаємо помилку.
 * Ендпоінти й схеми — з офіційної документації Cliniccards (Postman).
 */

if (typeof window !== "undefined") {
  throw new Error("Cliniccards client є серверним модулем і не може імпортуватися в клієнті.");
}

/** Сирі форми відповідей (лише потрібні поля). */
export interface RawShift {
  schedule_shift_id: string;
  doctor_id: string;
  doctor: string;
  shift_start: string;
  shift_end: string;
  schedule_cabinets_id: string;
  schedule_cabinet_name?: string;
}

export interface RawSpace {
  schedule_space_id: string;
  space_start: string;
  space_end: string;
  schedule_cabinets_id?: string;
  type?: string;
}

export interface RawVisit {
  visit_id: string;
  doctor_id: string;
  visit_start: string;
  visit_end: string;
  status: string;
}

export interface RawPatient {
  patient_id: string;
  firstname: string;
  lastname: string;
  phone: string;
}

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

export interface RawCreatedVisit {
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  visit_start: string;
  visit_end: string;
  note?: string;
}

interface Envelope<T> {
  data: T;
  result: "success" | "fail";
  error: string | null;
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

    const json = (await res.json()) as Envelope<T>;
    if (json.result !== "success") {
      throw new Error(`Cliniccards ${path}: ${json.error ?? "невідома помилка"}`);
    }
    return json.data;
  }

  getShifts(from: string, to: string): Promise<RawShift[]> {
    return this.request<RawShift[]>("/schedule-shifts", { query: { from, to } });
  }

  getSpaces(from: string, to: string): Promise<RawSpace[]> {
    return this.request<RawSpace[]>("/schedule-spaces", { query: { from, to } });
  }

  getVisits(from: string, to: string): Promise<RawVisit[]> {
    return this.request<RawVisit[]>("/visits", { query: { from, to } });
  }

  findPatientByPhone(phone: string): Promise<RawPatient[]> {
    return this.request<RawPatient[]>("/patients", { query: { phone } });
  }

  createPatient(body: { firstname: string; lastname: string; phone: string }): Promise<RawPatient> {
    return this.request<RawPatient>("/patients", { method: "POST", body });
  }

  createVisit(body: CreateVisitBody): Promise<RawCreatedVisit> {
    return this.request<RawCreatedVisit>("/visits", { method: "POST", body });
  }
}
