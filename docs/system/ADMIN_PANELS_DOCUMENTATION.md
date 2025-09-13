# Адмін-панелі: підключення та імпорт

Описує, як зберігаються та використовуються підключення до зовнішніх адмін-панелей (наразі TalkyTimes/DataMe) для імпорту профілів.

## Бекенд

- Ендпоїнти (всі під `api`):
  - `POST /api/datame/login` — логін до платформи; зберігає cookie в агентському scope та upsert-ить запис у `AdminPanelConnection`.
  - `POST /api/datame/collection` — посторінкове отримання схвалених профілів (потрібна cookie-сесія).
  - `POST /api/datame/form-data` — деталі профілю (email та ін.), використовується для збагачення під час імпорту.
  - `POST /api/datame-import/check-duplicates` — перевірка дублікатів по `id`/email серед профілів агенції.
  - `POST /api/datame-import/import` — імпорт обраних профілів у групу.
  - `GET /api/admin-panels` — список підключень поточної агенції.
  - `POST /api/admin-panels/update` — best-effort оновлення `count/status` підключення.
  - `DELETE /api/admin-panels` — видалення підключення (за email у межах агенції).

- Авторизація: всі ендпоїнти захищені `JwtAuthGuard` і ролями (`OWNER`), окрім публічних (`/api/version`).

- Зберігання підключень: Prisma модель `AdminPanelConnection`:
  - Поля: `id`, `platform`, `email`, `status`, `lastUpdatedAt`, `count`, `agencyId`, `passwordEnc`, `createdAt`, `updatedAt`.
  - Унікальність: `@@unique([agencyId, platform, email])`.

- Синхронізація схеми прод-БД: використовується `prisma db push` для оперативного вирівнювання; міграції — окремо.

## Фронтенд (`/owner/settings`)

- Показує список підключень (`GET /api/admin-panels`).
- Модалка підключення: логін → додає тимчасовий айтем і одразу запускає збір профілів.
- Кнопка «…» (три крапки): редагування / видалення локально; видалення на сервер — `DELETE /api/admin-panels`.
- Лічильник профілів та час останнього оновлення підтримуються на клієнті; за можливості синхронізуються через `POST /api/admin-panels/update`.

## Відомі нюанси

- При першому деплої: перевірити наявність таблиці `AdminPanelConnection` (або виконати `prisma db push`).
- Якщо `/api/admin-panels` повертає 500 — перевірити JWT, агенцію користувача, наявність таблиці та доступність БД.

## Приклади запитів

```
# Логін до платформи
POST /api/datame/login
{ "email": "user@example.com", "password": "secret" }

# Список підключень
GET /api/admin-panels

# Оновити лічильник
POST /api/admin-panels/update
{ "email": "user@example.com", "count": 123, "status": "connected" }

# Видалити підключення
DELETE /api/admin-panels
{ "email": "user@example.com" }
```


