## DOCUMENTATION

Цей документ синхронізований зі станом коду. Після кожної зміни — оновлюємо.

### Архітектура

- Моно-репозиторій (npm workspaces): `apps/*`, `packages/*`.
- `apps/web` — Next.js 15 (App Router, TailwindCSS 4).
- `apps/server` — NestJS 11 (порт за замовчуванням 4000), глобальні `JwtAuthGuard` і `RolesGuard`.
- Prisma + SQLite (локально), добові бекапи через `@nestjs/schedule`.

### Налаштування середовища

- Node.js LTS, npm.
- Порти: Web 3000, API 4000.
- `apps/server/.env` приклад:
  - `DATABASE_URL="file:./prisma/dev.db"`
  - `JWT_SECRET` — обовʼязково
  - `ENCRYPTION_KEY` — 32 байти для AES-256-GCM

### Скрипти

- `npm run dev` — одночасний запуск `web` і `server` (concurrently) з очищенням портів 3000/4000.
- `npm run build` — збірка всіх воркспейсів.
- `npm run start` — запуск бекенду в прод-режимі.
- `npm --workspace apps/server run seed` — заповнення БД демо-даними.

### Поточний стан (MVP)

- Аутентифікація: username + password (JWT 1d). `POST /auth/login` — публічний.
- Авторизація (RBAC): `@Roles`, `RolesGuard` (403, якщо ролі немає).
- Глобальний `JwtAuthGuard` (401 при невалідному токені).
- Користувачі: `User { username unique, passwordHash not null, role, operatorCode? }` — без email.
- Сидинг: створюються `owner/owner123`, `operator/operator123`, агенція та дані TT-профілів.
- TalkyTimes провайдер: мок-режим без `TT_BASE_URL`.
- Чати: REST + WebSocket (JWT перевіряється у handshake `auth.token`).
- Frontend: логін-сторінка (username/password), збереження JWT у localStorage, автододавання Bearer до API, 401-редірект на `/login`.
- UI: primary колір `#680098`.

### Ендпоінти (вибірково)

- `POST /auth/login` — отримати `{ accessToken }`
- `GET /api/chats/dialogs` — список діалогів (JWT)
- `GET /api/chats/dialogs/:id/messages` — повідомлення (JWT)
- `POST /api/chats/dialogs/:id/text` — надіслати текст (JWT)

### Dev нотатки

- Після міграцій — виконати сид: `npm --workspace apps/server run seed`.
- Якщо порт 4000 зайнятий — вбити процес: `lsof -nP -iTCP:4000 -sTCP:LISTEN -t | xargs kill -TERM`.


