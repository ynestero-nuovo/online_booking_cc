# ROADMAP — Онлайн-запис (PWA) для салону краси

## Проєкт
Мобільний веб-застосунок (PWA) онлайн-запису для салону краси. Замінює незручний
нативний онлайн-запис нашої CRM. Має відчуватися «нативно» на смартфоні: інсталяція
на головний екран, повний екран, швидкі переходи.

## Референс UX (логіка, яку повторюємо)
Зразок — bookon.ua. Флоу:
- Послуги згруповані за категоріями (топ-послуги, манікюр майстер, манікюр топмайстер, педикюр).
- Три режими старту запису:
  - вибрати спеціаліста → у календарі лише його доступні слоти;
  - вибрати послугу (або «Будь-який фахівець») → доступні будь-які коректні дати в усіх
    спеціалістів, що надають послугу;
  - вибрати час → записатися на час + додати коментар.
- Час протягом дня згрупований: Ранок / День / Вечір.
- Фінальний крок: ім'я, телефон, коментар → підтвердження.

## CRM та API
- CRM: Cliniccards (МІС). Має відкрите API (документація в Postman).
- API дає примітиви: список спеціалістів, зміни (shifts), розклад/візити, вільний час,
  створення запису, послуги (можливо з категоріями). Пацієнт ідентифікується за номером телефону.
- ВАЖЛИВО: точні ендпоінти й схеми відповідей ще НЕ підтверджені. Тому будуємо все на
  мок-провайдері, а реальний адаптер Cliniccards підключаємо в кінці (Крок 9).

## Стек
Next.js (App Router), TypeScript (strict), Tailwind CSS, Vitest. PWA.
(Capacitor — можливий апгрейд для App Store/Google Play пізніше.)

## Архітектура (полегшена гексагональна)
Залежності строго в один бік:
UI → BFF (серверні роути `app/api`) → ports (інтерфейс `BookingProvider`) → adapter
(Cliniccards або mock). Шар `domain` (типи + чиста логіка) не залежить ні від чого.
Структура: `src/domain`, `src/integration/cliniccards`, `src/server`, `src/lib`, `src/ui`.

## Правила (Rules)
- Секрети (ключ Cliniccards тощо) — тільки в `.env` на сервері. Ніколи в клієнтський
  бандл, ніколи в git, ніколи в `CLAUDE.md`.
- Фронт ходить ТІЛЬКИ у власні `/api` роути, ніколи напряму в Cliniccards.
- Mock-first: спершу все на MockProvider, реальний Cliniccards-адаптер — в кінці.
- Доступність рахуємо самі: вільні слоти = зміни лікаря − (візити + резерви), поріжені
  на крок (`stepMin`) під тривалість послуги (`durationMin`); відкидаємо слоти, де
  послуга не влазить до кінця зміни.
- Час — ISO-рядки в UTC.
- Працюємо малими кроками; на великих змінах спершу показуй план; після кроку — git commit.

## Доменна модель (`src/domain/types.ts`)
- `Specialist(id, name, alias, role)`
- `Category(id, name, order)`
- `Service(id, name, categoryId, durationMin, price, specialistIds[])`
- `Shift(specialistId, date, startTime, endTime)`
- `Busy(specialistId, startTime, endTime)` — візити + резерви разом
- `Slot(specialistId, startTime, endTime)`
- `TimeGroup` = `'morning' | 'afternoon' | 'evening'`
- `GroupedSlots` = `Record<TimeGroup, Slot[]>`
- `BookingRequest(specialistId, serviceIds[], startTime, patient{name,phone}, comment?)`
- `Booking` = `id` + поля `BookingRequest` + `status`
- Час — ISO.

## План (статус)
- [x] **Крок 1** — CLAUDE.md, скафолд Next.js (App Router, TS strict, Tailwind), Vitest,
  структура папок, `.env.example`, `.gitignore`, git init + commit.
- [x] **Крок 2** — `src/domain/types.ts`: доменні типи (вище), без залежностей і без логіки.
- [x] **Крок 3** — `src/integration/ports.ts` (інтерфейс `BookingProvider`: `getSpecialists`,
  `getCategories`, `getServices`, `getShifts(range)`, `getBusy(range)`, `createBooking`)
  + `src/integration/mock.ts` (MockProvider з реалістичними фейковими даними: 4–5
  спеціалістів різних ролей, 2–3 категорії з послугами, зміни на 7 днів, кілька busy;
  усе в пам'яті).
- [x] **Крок 4 (найважливіший)** — `src/domain/availability.ts` чистими функціями:
  `computeFreeSlots(shifts, busy, durationMin, stepMin)` для одного спеціаліста; режими
  «по лікарю» / «по послузі» (об'єднання спеціалістів) / «будь-який фахівець»; групування
  на Ранок/День/Вечір. СПЕРШУ Vitest-тести на крайні випадки (перетин на межі, слот рівно
  в кінці зміни, проміжок коротший за послугу, порожня зміна, кілька busy підряд), ПОТІМ
  реалізація; тести мають бути зелені.
- [ ] **Крок 5** — `src/lib/config.ts`: читає env (`CLINICCARDS_API_KEY`,
  `CLINICCARDS_BASE_URL`, `PROVIDER=mock|cliniccards`), фабрика повертає провайдера;
  дефолт mock; ключ лише на сервері.
- [ ] **Крок 6** — BFF роути: `GET /api/specialists`; `GET /api/services` (з категоріями);
  `GET /api/availability` (date або діапазон, опц. `specialistId`, опц. `serviceId` →
  згруповані слоти через рушій з Кроку 4); `POST /api/bookings` (zod-валідація; перед
  створенням ще раз перевірити що слот вільний → інакше 409; ідемпотентність через
  Idempotency-Key). Провайдер беруть з config.
- [ ] **Крок 7** — UI вертикальний зріз (mobile-first, ходить ТІЛЬКИ в `/api/*`): вибір
  спеціаліста (+«Будь-який фахівець») → послуги за категоріями → календар + сітка часу
  (Ранок/День/Вечір) → підтвердження (ім'я, телефон, коментар → POST /api/bookings) →
  екран успіху. Переходи як повноекранні екрани/шторки.
- [ ] **Крок 8** — PWA + крафт: manifest + service worker (інсталяція, display standalone);
  safe-area через `env(safe-area-inset-*)`; font-size 16px на інпутах (щоб iOS не зумив);
  вимкнути tap-highlight; інерційний скрол; скелетони замість спінерів.
- [ ] **Крок 9** — Реальний Cliniccards: `src/integration/cliniccards/client.ts` (HTTP з
  ключем з env, server-only) + `mapper.ts` (сирі відповіді Cliniccards → доменні типи);
  `CliniccardsProvider` у фабрику; `PROVIDER=cliniccards`; перевірка проти реальних
  прикладів відповідей. Фронт і контракт `/api` не змінюються.
