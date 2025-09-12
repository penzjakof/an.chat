## TODO-План оптимізації архітектури (без зміни суті)

Мета: спростити кодову базу, зменшити звʼязність, підвищити стабільність і спостережуваність без зміни бізнес-логіки.

### Фаза 1 — низький ризик, швидкий ефект
- [x] Backend/Core: підключити `@nestjs/config` + схеми валідації (Zod), прибрати прямі `process.env`.
- [ ] Backend/Core: увімкнути глобально `ValidationPipe({ whitelist: true, transform: true })`.
- [ ] Backend/Core: додати `LoggingInterceptor` і `HttpExceptionFilter`; замінити `console.log` на `Logger`.
- [ ] Chats: додати ліміт паралельних запитів у `chats.service` (p-limit 5–8 замість повного `allSettled`).
- [ ] Chats: запровадити мінімальний `CursorCodec` (типізація й перевірка курсорів).
- [ ] Frontend: підключити React Query для списку діалогів (кеш/пагінація/префетч).
- [ ] Infra/PM2: вимкнути довгоживучі `pm2 logs`-воркери (не тримати tail як процес).
- [ ] Nginx: перевірити `proxy_pass` слеші та `proxy_read_timeout` для API/WebSocket.

### Фаза 2 — структурні покращення
- [ ] TT Provider: розбити `talkytimes.provider.ts` на модулі: `http.client`, `sessions`, `mappers`, `resources/*`.
- [ ] TT Provider: зрівняти HTTP-шар через `ConnectionPoolService`, прибрати дубль `fetchWithTimeout`.
- [ ] TT Provider: додати `TTLCache` для стікерів/профілів із метриками та інвалідаторами по подіях.
- [ ] Observability: `RequestIdInterceptor` + прокидати `X-Request-ID` з Nginx до Nest.
- [ ] Observability: метрики через `prom-client` (`/metrics`), базові графіки.
- [ ] Rate limiting: винести профілі `@Throttle` у централізований конфіг.

### Фаза 3 — сесії, БД та типізація
- [ ] TT Sessions: модель з зашифрованим cookie-jar, `expiresAt`, `lastValidatedAt`, `source`.
- [ ] TT Sessions: фоновий валідатор/рефрешер (scheduler) з backoff.
- [ ] Profiles: централізувати оновлення пароля; аудит у `ShiftLog`.
- [x] Prisma/DB: переглянути/додати індекси під ключові запити; звести повʼязані записи в `prisma.$transaction`.
- [ ] Frontend/Types: в CI запускати `tsc --noEmit` як окремий job (warning-режим).
- [ ] Frontend/Types: поступово прибрати `ignoreDuringBuilds` і `ignoreBuildErrors` у `next.config.ts`.

### Безпека та документація (паралельно з фазами)
- [x] Секрети/ключі винести в `.env` / Secret Manager; прибрати з `.md`.
- [ ] RBAC: уніфікувати `@Roles`; додати інтеграційні тести доступів.

### Що прибрати / спростити
- [ ] Дублікати HTTP-логіки — залишити один шлях через `ConnectionPoolService`.
- [ ] `console.log` у контролерах — замінити на логер/інтерсептори.
- [ ] Роздуті контролери — перенести бізнес-логіку в сервіси.
- [ ] Монолітний TT-провайдер — розділити на модулі (див. Фаза 2).

### Definition of Done
- [ ] Помітне зменшення латентності діалогів, прогнозована логіка фейлів/ретраїв.
- [ ] Структуровані логи з кореляцією, доступні метрики (`/metrics`).
- [ ] Стабільний білд; поступове повернення strict TS без блокування прод-білду.
- [ ] Документація актуальна; секрети відсутні у репозиторії.


