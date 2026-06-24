## Project
Мобільний PWA онлайн-запису для клініки естетичної медицини/косметології «Nuovo skin»
(вул. Набережно-Хрещатицька 25), що проксує запити до зовнішньої CRM **Cliniccards**.
Розгорнуто публічно на **Render**.

## Status (станом на 2026-06-23)
Усі заплановані кроки (1–10) виконано; застосунок **у проді на Render**, на **реальній CRM**.
Повний журнал — у `docs/ROADMAP.md`.

- **Деплой:** GitHub `github.com/ynestero-nuovo/online_booking_cc` (гілка `main`, autoDeploy).
  Render Blueprint — `render.yaml` (web/node, `npm ci && npm run build` → `npm run start`).
  Секрет `CLINICCARDS_API_KEY` задається в дашборді Render (`sync:false`); `PROVIDER=cliniccards`
  і `CLINICCARDS_BASE_URL` — з `render.yaml`. **Якщо `PROVIDER` не задано → дефолт `mock`** (фейк).
- **Провайдер:** `cliniccards` (і локально в `.env`, і на Render) → пише в **реальну CRM**.
  Для безпечної розробки став `PROVIDER=mock`.

### Cliniccards-інтеграція (звірена наживо)
- Auth — заголовок `Token`; конверт відповіді `{ data, result, error }`; база `https://cliniccards.com/api`.
- `src/integration/cliniccards/`: `client.ts` (HTTP, **server-only**), `mapper.ts`, `provider.ts`,
  `timezone.ts`, `catalog.ts`, `staff.ts`.
- Реальні `doctor_id` (у `staff.ts` — роль і фото, у `catalog.ts` — мапа ключів):
  `79215` Ковбаса Катерина (Головний лікар), `79264` Самоукова Вікторія, `79716` Кашицька Ольга,
  `94758` Мовчан Тетяна (Лікарі), `88387` Калашнік Катерина (Косметолог).
- `getBusy` = `/visits` (крім статусу `CANCELLED`) + `/schedule-spaces` (резерв кабінету →
  лікар через зміну в тому ж кабінеті). Спеціалісти виводяться зі `/schedule-shifts`.
- `createBooking`: пошук пацієнта за **нормалізованим телефоном** (лише цифри) → за потреби
  `POST /patients` → `POST /visits` (`status=BOOKING`, кабінет зі зміни лікаря, час кратно 5 хв).
  `note` = стандартний перший рядок «З онлайн запису», далі назви обраних послуг (кожна з нового
  рядка) + коментар клієнта останнім, ≤400 символів.
- ⚠️ **КЛЮЧОВЕ ОБМЕЖЕННЯ (перевірено 2026-06-23): API НЕ дозволяє прив'язати послугу/процедуру
  до візиту.** `POST /visits` має лише `status, patient_id, cabinet_id, doctor_id, note, date,
  time_start, time_end`; немає ендпоінтів запису plan-items/treatments і немає каталогу послуг.
  Тому послуги фіксуються **лише текстом у `note`**; наш каталог — окреме джерело (нижче).

### Каталог послуг
- **АВТОГЕНЕРОВАНИЙ** `src/integration/catalog.ts` ← `src/lib/price_spec_map/pricemap.xlsx`
  (аркуш «прайс для онлайн запису») через `scripts/generate-catalog.ps1`. **Не редагувати руками.**
- **25 категорій / 217 послуг** з реальними тривалостями (30/45/60/90/120 хв) і цінами.
- `CatalogService.providers` — ключі лікарів (`kovbasa|samoukova|kashytska|movchan|kalashnik`);
  порожня клітинка тривалості в матриці = лікар НЕ надає послугу. Mock маплить ключі на `sp-*`,
  Cliniccards — на реальні `doctor_id`. Послуги «(головний лікар)» = окремі позиції Ковбаси з вищою ціною.

### Домен і час
- `src/domain/`: `types.ts` (без логіки) + `availability.ts` (чисті функції). Час — **ISO/UTC**.
- Доступність: вільні слоти = зміни − (візити + резерви), нарізані кроком `STEP_MIN=30` під
  **сумарну** тривалість обраних послуг; режими «по лікарю» / «по послузі» (перетин) / «будь-який».
- Cliniccards віддає **київський настінний** час → конвертація в `src/lib/timezone.ts`
  (`kyivWallToUtcIso`/`utcIsoToKyivParts`/`kyivHour`/`kyivDate`, з DST). **UI показує київський час.**

### UI / UX (`src/ui/booking/`)
- bookon-стиль: головна — форма з 3 полів (Фахівець/Послуга/Дата і час), повноекранні шторки (`Overlay`).
- **Множинний вибір послуг** (сума ціни/тривалості); **місячний календар**.
- **Взаємна фільтрація:** час можна обрати до спеціаліста → список лікарів = вільні на цей час
  (`/api/availability?...&dedup=false`); послуга → лише її лікарі; зміна лікаря прибирає несумісні послуги.
- **Телефон**: фіксований префікс `+38` + рівно 10 цифр (валідація і на клієнті, і на сервері).
- **Згода**: чекбокс «Користувацька угода / Політика конфіденційності» (поп-апи) блокує «Підтвердити візит».
  Тексти — `src/lib/policy/*.md` → `index.ts` через `scripts/generate-policy.mjs`; рендер `Markdown.tsx`.
- **Екран успіху** показує послуги/фахівця/дату/час. **«Про нас»** (`src/lib/salon.ts`): телефон (`tel:`),
  Instagram, Telegram, клікабельна адреса → Google Maps.

### Бренд, PWA, кеш
- Бренд `Nuovo skin`, колір `#8272a3`. Лого `src/img/logo/logo.png` → `public/logo.png` + favicon
  (`app/icon.png`) + PWA-іконки через `scripts/generate-logo-assets.mjs`.
- Фото лікарів — `public/specialists/*.png` (256px, `scripts/resize-photos.mjs`); оригінали в
  `src/img/specialists/` — **gitignored**. Аватари через `next/image` з фолбеком на ініціали.
- Service worker (`public/sw.js`) реєструється **лише в проді**; у dev знімається.
- **Кешуються тільки фото/іконки** (Cache-Control тиждень + `next/image`); API/доступність — без кешу (актуальність).

## Stack
Next.js 16 (App Router, Turbopack), TypeScript (strict), Tailwind CSS v4, Vitest, zod. Node ≥20.

## Architecture
Полегшена гексагональна, залежності строго в один бік:
- UI → BFF (серверні роути `app/api`) → ports (інтерфейс `BookingProvider`) → adapter (Cliniccards|mock).
- Шар `domain` (типи + чиста логіка) не залежить ні від чого.
- Структура: `src/domain`, `src/integration` (+`/cliniccards`), `src/server`, `src/lib`, `src/ui`, `src/app`.

## Rules
- Секрети (ключ Cliniccards тощо) — тільки в `.env`/env Render. Ніколи в клієнт, ніколи в git, ніколи тут.
- Фронт ходить **ТІЛЬКИ** у власні `/api` роути, ніколи напряму в Cliniccards.
- Доступність рахуємо самі (формула вище). Час — ISO-рядки (UTC); показ — київський.
- Каталог/політики/лого/фото — **генеровані**: після зміни джерела запускай відповідний скрипт (нижче).
- Працюємо малими кроками; після кроку — git commit (+ push, бо Render autoDeploy).

## Commands
- dev: `npm run dev` · test: `npm run test` · lint: `npm run lint` · build: `npm run build`
- Регенерації:
  - каталог: `powershell -File scripts/generate-catalog.ps1` (← `pricemap.xlsx`)
  - політики: `node scripts/generate-policy.mjs` (← `src/lib/policy/*.md`)
  - лого/іконки: `node scripts/generate-logo-assets.mjs` · фото: `node scripts/resize-photos.mjs`

## Open items / відомі обмеження
- **Процедуру не прикріпити до візиту** (обмеження API Cliniccards) — лишається текстом у `note`.
  Розблокування: уточнити в підтримці Cliniccards недокументоване поле/ендпоінт, інакше — статус-кво.
- **Немає антиспаму** на публічному `POST /api/bookings` (будь-хто може створювати реальні візити).
- **Немає кешу API** під ліміт Cliniccards (60 req/хв) — ризик під трафіком.
- «Будь-який фахівець» + одночасне бронювання автопризначеного лікаря → відновлюваний `409`.
- Ціни/тривалості/провіжн — джерело правди `pricemap.xlsx`; правити там і перегенеровувати.
- `docs/payloads/` — приклади реальних пейлоадів (ланцюг створення запису + GET-відповіді).
