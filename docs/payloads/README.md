# Приклади пейлоадів

Реальні форми запитів/відповідей, якими обмінюються шари застосунку.
Значення — приклади (id вигадані, але форма точна). Час у домені — **UTC**;
Cliniccards приймає/повертає **київський настінний** час.

```
Браузер ──JSON──> наш BFF (/api/*) ──Token──> Cliniccards API
```

> ⚠️ Заголовок `Token` — це секретний ключ із `.env` (`CLINICCARDS_API_KEY`).
> У прикладах він показаний як `<CLINICCARDS_API_KEY>` і НІКОЛИ не комітиться.

---

## Створення запису (після «Підтвердити візит»)

Користувач обрав 2 послуги (1655815 «Консультація первинна лікаря-дерматолога, дерматологічна/трихологічна з призначенням лікування» 60 хв +
1655820 «Азелаїново-саліциловий пілінг ОБЛИЧЧЯ Simildiet» 60 хв = 120 хв), лікаря 79264
(Самоукова), час 10:00 за Києвом 23.06.2026 (= `07:00:00.000Z`), і ввів дані.

### 1. Браузер → BFF
`POST /api/bookings` — тіло у `create-booking.request.json`, відповідь `201` у
`create-booking.response.json`.

Заголовки запиту:
```
Content-Type: application/json
Idempotency-Key: 3f1c2e7a-9b40-4d2a-8c11-6a7e5d9f0b21
```
- `serviceIds` — id з каталогу (`src/integration/catalog.ts`).
- `startTime` — ISO/UTC.
- `patient.phone` — повний номер `+38XXXXXXXXXX`.
- `comment` — необов'язковий.
- `Idempotency-Key` — UUID; повтор з тим самим ключем не створює дубль.

### 2. BFF → Cliniccards (усередині `CliniccardsProvider.createBooking`)
Послідовно:

**2a. Знайти пацієнта за телефоном** (нормалізованим — лише цифри):
`GET /api/patients?phone=380969860587` → `cliniccards-find-patient.response.json`.

**2b. Якщо не знайдено — створити пацієнта:**
`POST /api/patients` → `cliniccards-create-patient.request.json` / `.response.json`.

**2c. Створити візит:**
`POST /api/visits` → `cliniccards-create-visit.request.json` / `.response.json`.
- Тривалість = сума послуг → `time_start`/`time_end` у київському часі, кратно 5 хв.
- `cabinet_id` береться зі зміни лікаря на цю дату.
- `note` = стандартний перший рядок «З онлайн запису», далі назви обраних послуг (кожна з нового рядка) + коментар клієнта останнім.
- `status` = `BOOKING`.

`visit_id` з відповіді стає `booking.id`; `status` мапиться `BOOKING → pending`.

---

## Читання (GET) — формують екрани

| Ендпоінт | Файл прикладу |
|---|---|
| `GET /api/specialists` | `get-specialists.response.json` |
| `GET /api/services` | `get-services.response.json` |
| `GET /api/availability?serviceIds=1655815,1655820&from=…&to=…` | `get-availability.response.json` |

`/api/availability` приймає також `specialistId` (звузити до лікаря) і `dedup=false`
(слот на кожного вільного лікаря — щоб дізнатись, хто вільний на конкретний час).

---

## Конверт відповідей Cliniccards
Усі відповіді Cliniccards мають форму:
```json
{ "data": { }, "result": "success", "error": null }
```
На помилці `result: "fail"` і `error` — текст; наш клієнт кидає виняток.
