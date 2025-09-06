# Changelog

## [1.2.5] - 2025-09-06

### ⚡ Автооновлення та видалення діалогів зі "Вхідні"

#### ✨ Нове
- **Миттєве видалення після відправки**: Після успішної відправки будь-якого типу повідомлення (текст, стікер, фото/відео/аудіо, подарунок, лист, пост) діалог одразу видаляється зі списку "Вхідні"
- **Селективна логіка для листів**: При відправці листа видаляється лише айтем з поміткою "Новий лист", чат-айтем залишається в списку
- **Автооновлення списку "Вхідні"**: Кожні 60 секунд автоматично перезавантажується список діалогів у фільтрі "Вхідні"
- **Подієва система**: Використання `window.dispatchEvent('dialog:sent')` з параметрами `profileId`, `clientId`, `kind` для комунікації між компонентами

#### 🏗️ Технічні деталі
- **Реалізація**: Слухач подій у `apps/web/src/app/chats/layout.tsx` миттєво фільтрує список без перезавантаження з сервера
- **Умовне автооновлення**: Інтервал активується тільки коли вибраний фільтр "Вхідні" (`status: 'unanswered'`)
- **Повне перезавантаження**: Використовується `loadDialogs(filters, true)` для отримання актуальних даних з сервера
- **Обробка типів повідомлень**: Підтримка всіх типів (текст, медіа, стікери, подарунки, пости, листи)
- **Селективне видалення**: Для листів видаляється тільки email-айтем (`__email: true`), для чатів - звичайний айтем

#### 📚 Документація
- `DOCUMENTATION.md`: оновлено розділ "Чат Система" з деталями про нові функції видалення та автооновлення

## [1.2.4] - 2025-09-12

### 😊 Emoji Picker для всіх текстових полів

#### ✨ Нове
- **EmojiPicker компонент**: вспливаюче вікно з вибором емодзі
  - Розташування: `apps/web/src/components/EmojiPicker.tsx`
  - Особливості: 100+ популярних емодзі в сітці 5xN, фіксовані слоти 36x36px, збільшені емодзі (+20%)
  - UX: кнопка 😀 поруч з інпутом, додавання кількох емодзі без закриття меню
- **Інтеграція в усі текстові поля**:
  - **Чат повідомлення**: кнопка поруч з інпутом "Напишіть повідомлення..."
  - **Ексклюзивні пости**: кнопка в textarea для тексту посту
  - **Повідомлення до подарунків**: кнопка в textarea для персонального повідомлення
  - **Листи (EmailHistory)**: кнопка в textarea для тексту листа
- **Функціональність**: додавання кількох емодзі підряд без закриття меню

#### 🎨 UI/UX покращення
- Фіксована сітка 5 емодзі в ряду з квадратними слотами 36x36px
- Збільшені емодзі (+20%) для кращої видимості
- Збереження меню відкритим після вибору для швидкого додавання
- Підтримка клавіатурної навігації (Escape для закриття)
- Hover ефекти та візуальна зворотня зв'язок

#### 📚 Документація
- `DOCUMENTATION.md`: оновлено розділ про Emoji Picker з новими характеристиками

## [1.2.3] - 2025-09-11

### 🎨 Кастомні елементи управління (Custom UI Controls)

#### ✨ Нове
- **CustomSelect компонент**: мінімалістичний кастомний випадаючий список замість системного `<select>`
  - Розташування: `apps/web/src/components/CustomSelect.tsx`
  - Особливості: плавні анімації відкриття/закриття, клавіатурна навігація, закриття при кліку поза елементом
  - Використання: фільтр статусу діалогів, пошук профілів у формі пошуку чатів
- **Кастомні скролбари**: заміна системних скролбарів на мінімалістичні
  - Стилі: додано до `apps/web/src/app/globals.css`
  - Дизайн: ширина 6px, сірий колір з hover ефектами, підтримка WebKit та Firefox
  - Застосування: всі елементи з `overflow-y-auto` отримали клас `custom-scroll`

#### 🎨 UI/UX покращення
- Узгоджений мінімалістичний дизайн елементів управління
- Плавні переходи та анімації
- Кращий користувацький досвід на всіх пристроях
- Підтримка клавіатурної навігації

#### 📚 Документація
- `DOCUMENTATION.md`: додано розділ «Кастомні елементи управління» у UI/UX секції

## [1.2.2] - 2025-09-05

### 👨‍💼 Операторські Зміни (Shifts) + Дашборд + RT Redirect

#### ✨ Нове
- Prisma: моделі `Shift`, `ShiftLog`, звʼязок `Group.activeShiftId` для атомарного зайняття груп.
- Backend:
  - (OPERATOR) `GET /api/shifts/is-active`, `GET /api/shifts/groups-status`, `GET /api/shifts/can-start`, `POST /api/shifts/start`, `POST /api/shifts/end`.
  - (OWNER) `GET /api/shifts/active`, `POST /api/shifts/force-end`, `GET /api/shifts/logs`.
  - Guards: доступ до `/api/chats/*` дозволений лише з активною зміною (крім OWNER).
  - Socket.IO: `shift_ended { operatorId }` транслюється після завершення зміни.
- Frontend:
  - `/dashboard` (оператор): список груп, «Почати зміну», «Завершити зміну», лівий сайдбар (домік / завершити / logout).
  - `/chats`: лівий сайдбар + кнопка-стрілка поруч з фільтрами.
  - Автоматичний редірект оператора з чатів на дашборд при `shift_ended` (перевірка `operatorId`==`userId`).
  - Збереження `userId` у сесії; fallback парсинг із JWT.

#### 🐛 Виправлення
- Фікс збірки у `ChatsGateway` (незакритий шаблонний літерал).

#### 📚 Документація
- `DOCUMENTATION.md`: новий розділ «Зміни операторів (Shifts)». 

### ✉️ Inbox/Unanswered інтеграція листів (TT connections/mails) — 2025-09-06

#### ✨ Нове
- Backend: `TalkyTimesProvider.getUnansweredMails(profileId)` — proxy до `https://talkytimes.com/platform/connections/mails` з `type: "inbox/unanswered"`, динамічні cookies і операторський реф-код.
- Backend: `ChatsService.fetchDialogs` — для статусу `unanswered` підвантажує непрочитані листи і додає їх як email-айтеми у загальний список діалогів.
- Фільтрація: елементи з `isTrustedUserAbused = true` не додаються у результат.

#### 🎨 Frontend
- `apps/web/src/app/chats/layout.tsx`: клік по email-айтему веде на `/chats/{pid-iid}?openEmailHistory=1&corrId=...`, що тригерить автівідкриття модалки історії листів.
- Email-айтеми мають спеціальний бейдж «Новий лист» (`__emailBadge`).

#### 🔧 Backend
- `apps/server/src/providers/site-provider.interface.ts`: додано контракт `getUnansweredMails`.
- `apps/server/src/providers/talkytimes/talkytimes.provider.ts`: реалізація `getUnansweredMails` з коректними headers (`origin`, `referer`) і `applyOperatorRefHeader`.
- `apps/server/src/chats/chats.service.ts`: інтеграція в `fetchDialogs` (агрегація з діалогами, нормалізація дати з `date_created`).

#### 🐛 Виправлення
- Виправлено навігацію: для email-айтемів додається `openEmailHistory` і `corrId`, щоб модалка відкривалась автоматично.

#### 📚 Документація
- `DOCUMENTATION.md`: додано секцію про Inbox/Unanswered, автівідкриття модалки, динамічні заголовки TT і referer.

### 🎨 UI покращення для email-айтемів — 2025-09-06

#### ✨ Нове
- **Email-айтеми в списку діалогів**: покращено візуальну ідентифікацію
- **Розташування**: дата зверху, "Новий лист" знизу з автоматичним відступом
- **Іконка листа**: додана SVG іконка листа з Heroicons (12x12px)
- **Жирний текст**: `font-bold` замість `font-medium` для "Новий лист"
- **Вирівнювання**: по правому краю з `justify-between` та `min-h-[2rem]`

#### 🎨 Frontend
- `apps/web/src/app/chats/layout.tsx`: оновлено структуру email-айтемів з `flex-col`, `justify-between`, іконкою та жирним текстом

#### 📚 Документація
- `DOCUMENTATION.md`: додано детальний опис UI для email-айтемів у розділі UI/UX

### ✉️ Листи з вкладеннями (MediaGallery attach) + Заборонені категорії

#### ✨ Нове
- `POST /api/chats/tt-forbidden-tags` — proxy до TT `correspondence/video/forbidden-tags` для отримання заборонених категорій (наприклад, `special_plus`).
- `POST /api/chats/send-letter` — proxy до TT `correspondence/send-letter` (поля `images[{idPhoto}]`, `videos[{idVideo}]`).
- У `EmailHistory` додано поле введення з лічильником (300–3000), кнопку "Атачмент" та "Надіслати" (активна тільки в діапазоні).
- Оптимістичне додавання щойно надісланого листа у список історії (з прев’ю прикріплень), автоскрол донизу.

#### 🎨 Frontend
- `EmailHistory.tsx`: інтеграція заборонених категорій; allowed вкладки: завжди `regular`/`temporary`, `special`/`special_plus` — залежно від `forbidden-tags`.
- `MediaGallery.tsx`:
  - Виправлено селекцію — не скидається при перемиканні між фото/відео.
  - У режимі attach дозволена селекція до 10 фото і до 10 відео одночасно.
  - Дозвіл вибору `regular`/`temporary` у attach; повага до `allowedPhotoTabs`.

#### 🔧 Backend
- `apps/server/src/providers/site-provider.interface.ts` — додано `getForbiddenCorrespondenceTags` і `sendLetter`.
- `apps/server/src/providers/talkytimes/talkytimes.provider.ts` — імплементація `getForbiddenCorrespondenceTags` і `sendLetter` з коректними headers/cookies.
- `apps/server/src/chats/chats.service.ts` — валідації довжини, зрізання до 10 фото/10 відео, делегація у провайдер.
- `apps/server/src/chats/chats.controller.ts` — ендпоінти `tt-forbidden-tags`, `send-letter`.

#### ⚡ Стійкість до rate limit
- `apps/web/src/lib/api.ts`: експоненційні ретраї для 429 з повагою `Retry-After`:
  - для всіх GET;
  - для POST статусів галереї: `/api/gallery/photo-statuses`, `/api/gallery/video-statuses`, `/api/gallery/audio-statuses`.

#### 🐛 Виправлення
- Неможливість вибору звичайних фото у attach — виправлено логіку `isPhotoSelectable`.
- Скидання вибору при перемиканні типу медіа — видалено зайвий reset селекції.

#### 📚 Документація
- `DOCUMENTATION.md` — додано розділ про надсилання листів з вкладеннями, нові ендпоінти та нотатку про 429 ретраї.

## [1.2.1] - 2025-09-04

### ⚡ TalkyTimes Exclusive Posts Detection (tier + UI)

#### ✨ Нове
- Додано бекенд-проксі `POST /api/chats/tt-restrictions` для gRPC-Web виклику TT GetRestrictions
- Парсер відповіді з визначенням `hasExclusivePosts`, категорій і підрахунку `categoryCounts`
- Визначення `tier`:
  - `specialplus` — коли немає розширених тегів 0x22/0x2a у protobuf
  - `special` — коли є розширені теги 0x22/0x2a
- Фронтенд відображає блискавку: червона для `specialplus`, жовта для `special` (tooltip з категоріями)

#### 🔧 Backend
- `apps/server/src/providers/talkytimes/talkytimes.provider.ts` — створення protobuf тіла, парсинг, tier, categoryCounts
- `apps/server/src/providers/site-provider.interface.ts` — контракт розширено (`tier`, `categoryCounts`)
- `apps/server/src/chats/chats.service.ts`, `chats.controller.ts` — ендпоінт `/api/chats/tt-restrictions`

#### 🎨 Frontend
- `apps/web/src/utils/grpcUtils.ts` — клієнт до бекенду, повертає `tier`
- `apps/web/src/app/chats/[dialogId]/page.tsx` — індикатор блискавки з кольором за `tier`; модалка Exclusive Post; прев’ю прикріплень; дві галереї (чат/attach)
- `apps/web/src/components/MediaGallery.tsx` — режим `attach`, нові пропси (`mode`, `actionLabel`, `allowAudio`, `allowedPhotoTabs`, `isSpecialPlusAllowed`, `onAttach`), автоселект першої вкладки, кольорові Special/Special+ в attach, іконки вкладок (вогонь; вогонь+плюс)

#### 🐛 Виправлення
- Неправильне формування referer/тіла для gRPC — виправлено
- Некоректна типізація body (Uint8Array → ArrayBuffer) — виправлено
- CORS: перенесено виклик з фронта на бекенд-проксі
- 404 на `/api/chats/tt-send-post`: вирішено повним перезапуском dev-процесів і синком білда

### ✉️ Exclusive Post Sending (нове)

#### ✨ Нове
- `POST /api/chats/tt-send-post` — проксі до `talkytimes.com/platform/chat/send/new-post`
- Модалка для відправки exclusive постів з валідацією: мін. 100 символів; правила вибору медіа (макс 1 відео; 1 відео + N фото; або ≥4 фото без відео)
- Attach-галерея відкривається з модалки; прев’ю вибраних фото/відео з можливістю видалення

#### 🔧 Backend
- `apps/server/src/chats/chats.controller.ts` — `POST /api/chats/tt-send-post`
- `apps/server/src/chats/chats.service.ts` — делегація у провайдер
- `apps/server/src/providers/site-provider.interface.ts` — `sendExclusivePost`
- `apps/server/src/providers/talkytimes/talkytimes.provider.ts` — імплементація `sendExclusivePost`


---

## [1.2.0] - 2025-01-04

### 🎵 Аудіо Галерея з Повноцінним Плеєром

#### ✨ Нові функції
- **Аудіо галерея** - Повнофункціональний компонент для відображення аудіо файлів
- **Професійний аудіо плеєр** - Повноцінний плеєр з таймлайном та контролами
- **TalkyTimes аудіо API** - Інтеграція з `/platform/gallery/audio/list`
- **Статуси аудіо** - Отримання та відображення статусів (sent/accessed/null)
- **Фільтри аудіо** - Фільтрація за статусами: Усі/Доступні/Переглянуті/Відправлені
- **Інтерактивний таймлайн** - Перемотування кліком по прогрес бару
- **Візуальні індикатори** - Кольорові індикатори статусів та тривалості

#### 🎵 Аудіо плеєр функції
- **Кнопка відтворення/паузи** з анімацією завантаження
- **Прогрес бар** з плавною анімацією та індикатором позиції
- **Відображення часу** (поточний/загальний) у форматі MM:SS
- **Перемотування** кліком по будь-якій частині таймлайну
- **Обробка помилок** з відповідними повідомленнями
- **Автоматичне керування** - тільки один аудіо відтворюється одночасно
- **Централізоване керування** - реєстрація всіх аудіо елементів

#### 🔧 Backend API
- `GET /api/gallery/:profileId/audios` - отримання аудіо з пагінацією
- `POST /api/gallery/send-audios` - відправка аудіо в чат
- `POST /api/gallery/audio-statuses` - отримання статусів аудіо
- Батчова обробка статусів по 100 аудіо за раз

#### 🎨 Frontend покращення
- Список аудіо з назвами файлів та датами створення
- Повноцінний плеєр для кожного аудіо файлу
- Нескінченний скрол з автоматичним підвантаженням
- Синхронізація фільтрів між усіма типами медіа
- Responsive дизайн з адаптивними контролами

#### 📊 Технічні деталі
- HTML5 Audio API для відтворення
- Курсор-базована пагінація з `id` аудіо
- Реєстрація аудіо елементів для централізованого керування
- Автоматична зупинка попереднього аудіо при запуску нового
- Обробка подій: `timeupdate`, `ended`, `error`, `canplay`
- Оптимізована фільтрація з мемоізацією

## [1.1.0] - 2025-01-04

### 🎥 Відео Галерея - Повна реалізація

#### ✨ Нові функції
- **Відео галерея** - Повнофункціональний компонент для відображення відео
- **TalkyTimes відео API** - Інтеграція з `/platform/gallery/video/list`
- **Відправка відео** - Пряма відправка в чат через `/platform/chat/send/gallery-video`
- **Статуси відео** - Отримання та відображення статусів (sent/accessed/null)
- **Фільтри відео** - Фільтрація за статусами: Усі/Доступні/Переглянуті/Відправлені
- **Повноекранний перегляд** - HD відео з fallback до SD якості
- **Візуальні індикатори** - Кольорові індикатори статусів та тривалості відео

#### 🔧 Backend API
- `GET /api/gallery/:profileId/videos` - отримання відео з пагінацією
- `POST /api/gallery/send-videos` - відправка відео в чат
- `POST /api/gallery/video-statuses` - отримання статусів відео
- Батчова обробка статусів по 100 відео за раз

#### 🎨 Frontend покращення
- Адаптивна сітка 5x5 з aspect-ratio 1:1
- Lazy loading превью зображень
- Нескінченний скрол з автоматичним підвантаженням
- Синхронізація фільтрів між фото та відео
- Оптимізована фільтрація з мемоізацією

#### 📊 Технічні деталі
- Курсор-базована пагінація з `idVideo`
- Візуальні індикатори: 🟢 accessed, 🟡 sent, без індикатора - доступно
- Відображення тривалості у форматі MM:SS
- Автоматичне завантаження статусів при завантаженні відео

## [1.0.0] - 2025-01-29

### 📸 MediaGallery - Повна реалізація

#### ✨ Нові функції
- **Медіа галерея** - Повнофункціональний компонент для відображення фото
- **TalkyTimes інтеграція** - Прямий зв'язок з TalkyTimes API для завантаження фото
- **Розділи фото** - "Доступні" та "Special" розділи в контексті чату
- **Автоматичне довантаження** - Розумне завантаження при недостатній кількості фото (< 15)
- **Скрол-пагінація** - Завантаження через скрол без кнопок
- **Відправка фото** - Пряма відправка в чат через TalkyTimes API
- **Візуальні індикатори** - Fire іконки для special фото, сірі фільтри для недоступних

#### 🔧 Технічні покращення
- **JWT автентифікація** - Виправлено проблеми з завантаженням JWT_SECRET
- **Оптимізація продуктивності** - Мемоізація, Set lookup, debounce
- **Запобігання витокам пам'яті** - Proper cleanup в useEffect
- **Валідація даних** - Перевірка props та API параметрів
- **Обробка помилок** - Graceful fallback при мережевих помилках

#### 🐛 Виправлені помилки
- Галерея не відкривалася через JWT помилки
- Дублікати ключів React при завантаженні фото
- Циклічне завантаження при пустій відповіді TalkyTimes
- Помилка "No active session found for profile 0"
- Фото не завантажувалися (сірі квадрати)

#### 📁 Файли змінено
**Frontend:**
- `apps/web/src/components/MediaGallery.tsx` - Головний компонент галереї
- `apps/web/src/app/chats/[dialogId]/page.tsx` - Інтеграція в чат
- `apps/web/src/lib/api.ts` - HTTP клієнт оптимізації

**Backend:**
- `apps/server/src/main.ts` - Завантаження environment змінних
- `apps/server/src/auth/auth.module.ts` - Асинхронна JWT конфігурація
- `apps/server/src/gallery/gallery.controller.ts` - REST API endpoints
- `apps/server/src/gallery/gallery.service.ts` - TalkyTimes інтеграція
- `apps/server/src/app.controller.ts` - @Public() декоратор

#### 📚 Документація
- `GALLERY_DOCUMENTATION.md` - Повна документація компонента
- `README.md` - Оновлено з інформацією про галерею

#### 🔄 API Endpoints
- `GET /api/gallery/:profileId/photos` - Отримання фото з пагінацією
- `POST /api/gallery/send-photos` - Відправка фото в чат

#### 🎯 Контексти використання
- **Chat context** - Розділи фото, обмежена селекція special фото
- **Profile/Other context** - Всі фото доступні для вибору

#### ⚡ Оптимізації
- Мемоізовані функції для фільтрації фото
- Set-based lookup для вибраних фото (O(1) замість O(n))
- Debounced scroll events (200ms)
- Автоматичний cleanup timeout та event listeners
- Валідація props та API параметрів

---

### Наступні кроки
- [ ] Error Boundary для галереї
- [ ] Віртуалізація для великих списків
- [ ] WebP підтримка
- [ ] React Query для кешування
- [ ] Intersection Observer для точнішого lazy loading
