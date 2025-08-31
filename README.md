## AnChat — платформа управління чатами

Моно-репозиторій з двома застосунками:

- `apps/web` — фронтенд (Next.js 15, App Router, TailwindCSS)
- `apps/server` — бекенд (NestJS 11)

### Запуск

Вимоги: Node.js LTS, npm.

Команди в корені:

```bash
npm run dev      # фронтенд (3000) + бекенд (4000)
npm run build    # збірка всіх робочих просторів
npm run start    # запуск бекенду у прод-режимі
npm run lint     # лінтинг
```

### Структура

- `apps/web` — Next.js застосунок (App Router)
- `apps/server` — NestJS API (REST + WebSocket у наступних етапах)
- `packages/` — спільні пакети (буде додано пізніше)
- `docs/` — документація, включно з `docs/talkytimes/current-api.md`

### Основні компоненти

#### 📸 MediaGallery
Повнофункціональний компонент для управління фото галереєю:
- Інтеграція з TalkyTimes API
- Розділи "Доступні" та "Special" фото в чаті
- Автоматичне довантаження та скрол-пагінація
- Відправка фото безпосередньо в чат
- Оптимізована продуктивність з мемоізацією

Детальна документація: [`GALLERY_DOCUMENTATION.md`](./GALLERY_DOCUMENTATION.md)

### Ліцензія

Приватний проєкт.


