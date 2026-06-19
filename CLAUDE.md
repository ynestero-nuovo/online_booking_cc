## Project
Мобільний PWA онлайн-запису для салону краси, який проксує запити до зовнішньої CRM Cliniccards.

## Stack
Next.js (App Router), TypeScript (strict), Tailwind CSS, Vitest.

## Architecture
Полегшена гексагональна, залежності строго в один бік:
- UI → BFF (серверні роути `app/api`) → ports (інтерфейс) → adapter (Cliniccards або mock).
- Шар `domain` (типи + чиста логіка) не залежить ні від чого.

## Rules
- Секрети (ключ Cliniccards тощо) — тільки в `.env` на сервері. Ніколи в клієнт, ніколи в git.
- Фронт ходить **ТІЛЬКИ** у власні `/api` роути, ніколи напряму в Cliniccards.
- Спершу все на мок-провайдері; реальний Cliniccards-адаптер — у самому кінці.
- Доступність рахуємо самі: вільні слоти = зміни лікаря − (візити + резерви), поріжені на крок під тривалість послуги.
- Час — ISO-рядки (UTC).

## Commands
- dev: `npm run dev`
- test: `npm run test`
- lint: `npm run lint`
