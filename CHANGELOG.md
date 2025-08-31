# Changelog

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
