# 📸 MediaGallery - Документація

## Огляд
MediaGallery - це повнофункціональний компонент для відображення та управління медіа контентом (фото, відео, аудіо) в AnChat додатку. Компонент інтегрується з TalkyTimes API для завантаження медіа та їх відправки в чат.

## Основні функції

### ✨ Ключові можливості
- 📱 Адаптивна сітка 5x∞ з lazy loading
- 🔥 Візуальні індикатори для special фото (fire іконка)
- 🎯 Типи контенту: Regular, Special, Special+, Temporary
- 🚀 Автоматичне довантаження при недостатній кількості (< 15)
- 📜 Завантаження через скрол без кнопок
- 📤 Відправка фото безпосередньо в чат
- 🎨 Сірі фільтри для недоступних фото
- ⚡ Уніфікований кеш на 24 години
- 🎵 Підтримка відео та аудіо контенту
- 📊 Фільтри по статусам (All, Available, Accessed, Sent)
- 🖼️ Повноекранний перегляд зображень
- 🔄 Автоматичне завантаження статусів фото
- 🏷️ Розширені теги та мета-дані

## Архітектура

### Frontend (React/Next.js)
```
apps/web/src/components/MediaGallery.tsx
├── Інтерфейси:
│   ├── Photo - основна структура фото
│   ├── PhotoTag - теги фото (special, special_plus, etc.)
│   ├── PhotoUrls - URL для різних розмірів
│   ├── PhotoStatus - статус модерації
│   ├── PhotoConnectionStatus - статус зв'язку
│   └── CachedPhotoData - структура кешу
├── Стан управління:
│   ├── photoType - тип контенту (regular/special/temporary)
│   ├── mediaType - тип медіа (photo/video/audio)
│   ├── statusFilter - фільтр по статусам
│   ├── photoStatuses - Map статусів фото
│   └── temporaryPhotoIds - набір temporary ID
├── Кешування:
│   ├── Уніфікований кеш на 24 години
│   ├── Автоматичне збереження/завантаження
│   └── Оптимізація пам'яті
├── UI компоненти:
│   ├── Повноекранний перегляд
│   ├── Фільтри та таби
│   ├── Індикатори статусів
│   └── Адаптивна сітка
```

### Backend (NestJS)
```
apps/server/src/gallery/
├── gallery.controller.ts  # REST API endpoints
├── gallery.service.ts     # Бізнес логіка та TalkyTimes інтеграція
└── gallery.module.ts      # Модуль конфігурації
```

## API Endpoints

### GET `/api/gallery/:profileId/photos`
Отримання списку фото з пагінацією та фільтрацією

**Параметри:**
- `profileId` (string) — ID профілю
- `cursor` (string, optional) — курсор для пагінації
- `limit` (string, optional) — кількість елементів (default: 50)
- `statuses` (string, optional) — список статусів (comma-separated), default: `approved,approved_by_ai`
- `tags` (string, optional) — список тегів (comma-separated), напр.: `special,special_plus`
- `isTemporary` (boolean, optional) — фільтр тимчасових фото (default: false)

**Відповідь:**
```json
{
  "success": true,
  "data": {
    "cursor": "49590541",
    "photos": [
      {
        "idPhoto": 49938731,
        "idUser": 117326723,
        "status": { "code": "approved_by_ai", "description": "Approved by AI" },
        "tags": [
          { "code": "special", "description": "Special" },
          { "code": "temporary", "description": "Temporary" }
        ],
        "urls": {
          "urlOriginal": "https://...",
          "urlPreview": "https://...",
          "urlStandard": "https://..."
        },
        "canDisagree": false,
        "comment": "",
        "declineReasons": []
      }
    ],
    "hasMore": true,
    "totalCount": 150
  }
}
```

### POST `/api/gallery/send-photos`
Відправка медіа контенту в чат

**Body:**
```json
{
  "idsGalleryPhotos": [51496050, 51496049],
  "idRegularUser": 26504239,
  "profileId": 7162437,
  "mediaType": "photo"
}
```

### POST `/api/gallery/photo-statuses`
Отримання статусів фото (accessed/sent/null)

**Body:**
```json
{
  "idUser": 117326723,
  "idsPhotos": [51496050, 51496049],
  "profileId": 7162437
}
```

**Відповідь:**
Проксі-відповідь TalkyTimes `/platform/gallery/photo/connection/list`.



## Використання компонента

### Базове використання
```tsx
import { MediaGallery } from '@/components/MediaGallery';

<MediaGallery
  profileId="7162437"
  isOpen={isGalleryOpen}
  onClose={() => setIsGalleryOpen(false)}
  onPhotoSelect={(photos) => console.log('Selected:', photos)}
  maxSelection={6}
  context="other"
/>
```

### Використання в чаті
```tsx
<MediaGallery
  profileId={profileId.toString()}
  isOpen={isMediaGalleryOpen}
  onClose={() => setIsMediaGalleryOpen(false)}
  onPhotoSelect={handlePhotoSelect}
  maxSelection={6}
  context="chat"
  idRegularUser={idRegularUser}
/>
```

### Режим прикріплення до Exclusive Post (attach)
```tsx
<MediaGallery
  profileId={profileId.toString()}
  isOpen={isAttachGalleryOpen}
  onClose={() => setIsAttachGalleryOpen(false)}
  onPhotoSelect={() => { /* не використовується в attach */ }}
  maxSelection={6}
  context="chat"
  idRegularUser={idRegularUser}
  mode="attach"
  actionLabel="Прикріпити"
  allowAudio={false}
  allowedPhotoTabs={tier === 'specialplus' ? ['special','special_plus'] : ['special']}
  isSpecialPlusAllowed={tier === 'specialplus'}
  onAttach={({ photos, videos }) => {
    // зберегти вибір та закрити модалку
  }}
/> 
```

Особливості attach:
- Початкова вкладка — перша дозволена (у більшості випадків `special`).
- Фото з тегами `special`/`special_plus` відображаються кольоровими (без grayscale).
- Мітки вкладок: `Special` з іконкою вогню; `Special+` з іконкою вогню та маленьким "+" ліворуч від назви.

## Props

| Prop | Тип | Обов'язковий | Опис |
|------|-----|-------------|------|
| `profileId` | string | ✅ | ID профілю для завантаження медіа |
| `isOpen` | boolean | ✅ | Стан відкриття галереї |
| `onClose` | () => void | ✅ | Callback для закриття галереї |
| `onPhotoSelect` | (photos: Photo[]) => void | ✅ | Callback для вибору фото |
| `maxSelection` | number | ❌ | Максимальна кількість вибраних фото (default: 6) |
| `context` | 'chat' \| 'profile' \| 'other' | ❌ | Контекст використання (default: 'other') |
| `idRegularUser` | number | ❌ | ID користувача для відправки в чат (обов'язковий для context='chat') |

## Нові інтерфейси

```typescript
interface CachedPhotoData {
  idPhoto: number;
  idProfile: number;
  idUser: number;
  urlPreview: string;
  urlOriginal: string;
  status: 'accessed' | 'sent' | null;
  category: 'regular' | 'special' | 'temporary';
  lastAccessed: number;
  tags: PhotoTag[];
}

interface PhotoConnectionStatus {
  idPhoto: number;
  status: 'accessed' | 'sent' | null;
}
```

## Логіка роботи

### Підтримка типів медіа
- **Photo**: зображення з різними розмірами (preview/standard/original)
- **Video**: відеофайли з прев'ю та оригінальними URL
- **Audio**: аудіофайли з метаданими

### Система кешування (24 години)
1. **Уніфікований кеш** для всіх типів медіа
2. **Автоматичне збереження** при завантаженні нових фото
3. **Інтелектуальне оновлення** статусів без перезавантаження
4. **Оптимізація пам'яті** з очищенням старих даних

### Фільтри та категорії
1. **Типи контенту:**
   - **Regular**: звичайні фото (селектабельні)
   - **Special**: особливі фото з тегами (сірі, неселектабельні)
   - **Temporary**: тимчасові фото (позначаються окремо)

2. **Статуси:**
   - **All**: всі фото
   - **Available**: доступні для відправки
   - **Accessed**: вже переглянуті
   - **Sent**: вже відправлені

### Автоматичне завантаження
1. **Статусів фото:** завантаження в фоні для відображення індикаторів
2. **Нових фото:** при скролі до кінця списку
3. **Пагінація:** курсор-based для ефективного завантаження

### Контекст "chat"
1. **Розділи фото:**
   - "Доступні": звичайні фото без special тегів (селектабельні)
   - "Special": фото з тегами special/special_plus (неселектабельні, сірі)
   - "Temporary": тимчасові фото (відзначаються іконкою)

2. **Статуси фото:**
   - Індикатори для accessed/sent фото
   - Автоматичне завантаження статусів
   - Фільтри по статусам

3. **Відправка фото:**
   - Через TalkyTimes API `/platform/chat/send/gallery-photos`
   - Підтримка пакетної відправки
   - Автоматичне закриття галереї після успішної відправки

### Контекст "other"/"profile"
- Показує всі фото без розділів
- Всі фото селектабельні
- Використовує callback `onPhotoSelect` замість API відправки
- Підтримка всіх фільтрів та типів медіа

## Оптимізації

### Система кешування
- **Уніфікований кеш на 24 години:** замість окремих курсорів для кожного типу
- **Інтелектуальне збереження:** автоматичне кешування нових фото та оновлення статусів
- **Оптимізація пам'яті:** очищення старих даних та дедуплікація
- **Персистентність:** збереження фільтрів та налаштувань між сесіями

### Продуктивність
- **Мемоізація:** `useMemo` для фільтрації та `useCallback` для функцій
- **Set/Map lookup:** O(1) перевірка вибраних фото та статусів
- **Debounce:** Обмеження частоти scroll events (200ms)
- **Virtual scrolling:** ефективне відображення великих списків
- **Cleanup:** запобігання витокам пам'яті в useEffect

### UX оптимізації
- **Lazy loading:** `loading="lazy"` для всіх медіа файлів
- **Skeleton states:** анімація завантаження для різних типів контенту
- **Error handling:** graceful fallback при помилках мережі
- **Валідація:** перевірка props та API параметрів
- **Повноекранний перегляд:** для детального огляду фото
- **Індикатори статусів:** візуальна інформація про стан фото

### Технічні оптимізації
- **Batch requests:** пакетне завантаження статусів фото
- **Smart pagination:** курсор-based пагінація для уникнення дублікатів
- **Memory management:** ефективне управління станом компонента
- **Type safety:** повна типізація всіх інтерфейсів та функцій

## TalkyTimes інтеграція

### Основні Endpoints:
- `POST /platform/gallery/photo/list` — отримання списку фото з фільтрацією
- `POST /platform/chat/send/gallery-photos` — відправка фото в чат
- `POST /platform/gallery/photo/connection/list` — статуси фото (accessed/sent)

### Нові параметри API:
- `mediaType`: фільтр по типу медіа (photo/video/audio)
- `photoType`: фільтр по типу фото (regular/special/temporary)
- `statuses`: фільтр по статусам модерації
- `batchSize`: розмір пакета для завантаження

### Автентифікація:
- Використовує TalkyTimes сесії напряму через cookies
- Не потребує внутрішнього JWT токена
- `@Public()` декоратор на галерея endpoints
- При 401 повертається порожня/помилкова відповідь; потрібна повторна автентифікація профілю в UI

### Обробка помилок:
- **401 Unauthorized:** повертається помилка/порожня відповідь; користувачу пропонується перев-автентифікація профілю
- **429 Rate Limit:** експоненціальна затримка повторних спроб
- **500 Server Error:** fallback на кешовані дані
- **Network Error:** retry з прогресивною затримкою

## Стилізація

### Tailwind CSS класи
```css
/* Основна сітка */
.grid.grid-cols-5.gap-2.max-h-[400px].overflow-y-auto

/* Special фото */
.grayscale.opacity-60  /* Сірий фільтр */

/* Fire іконка */
.bg-pink-500.rounded-full.shadow-sm  /* Рожевий фон з тінню */

/* Стани завантаження */
.animate-spin  /* Спінер */
```

### Адаптивність
- Фіксована сітка 5 колонок
- `aspect-square` для квадратних фото
- `max-h-[400px]` з вертикальним скролом

## Помилки та їх вирішення

### Типові проблеми:

1. **"No active session found for profile X"**
   - **Причина:** Неправильний profileId або відсутня сесія
   - **Рішення:** Перевірити profileId в props та стан сесії

2. **Дублікати ключів React / Неконсистентність кеша**
   - **Причина:** Паралельні запити або проблеми з кешуванням
   - **Рішення:** Дедуплікація через Set та перевірка кешу перед запитами

3. **Циклічне завантаження / Нескінченний скрол**
   - **Причина:** Пуста відповідь від TalkyTimes або проблеми з курсорами
   - **Рішення:** Перевірка hasMore та ліміт спроб завантаження (max 3)

4. **Витоки пам'яті**
   - **Причина:** Незакриті timeout, event listeners або великі об'єкти в стані
   - **Рішення:** Cleanup в useEffect return функціях та обмеження розміру кеша

5. **Не оновлюються статуси фото**
   - **Причина:** Проблеми з batch requests або мережеві помилки
   - **Рішення:** Повторні спроби з експоненціальною затримкою

6. **Повільне завантаження великих галерей**
   - **Причина:** Відсутня віртуалізація або надто великі зображення
   - **Рішення:** Intersection Observer для lazy loading та оптимізація розмірів

7. **Помилки кешування (24h cache)**
   - **Причина:** Проблеми з localStorage або JSON серіалізацією
   - **Рішення:** Graceful fallback на порожній кеш та валідація даних

8. **Неконсистентність фільтрів**
   - **Причина:** Асинхронні оновлення стану фільтрів
   - **Рішення:** useMemo для стабільних фільтрів та debouncing

### Діагностика:

```typescript
// Перевірка стану кеша
console.log('Cache status:', {
  photosCount: photos.length,
  cacheSize: Object.keys(cachedData).length,
  lastUpdate: new Date(lastCacheUpdate)
});

// Перевірка активних запитів
console.log('Active requests:', {
  loadingPhotos: loading,
  loadingStatuses: statusRequestedPhotos.size,
  hasMorePhotos: hasMore
});
```

## Тестування

### Ручне тестування:

#### Базова функціональність:
1. Відкрити галерею в різних контекстах (chat/profile/other)
2. Перевірити всі типи медіа (photo/video/audio)
3. Протестувати фільтри по статусам (all/available/accessed/sent)
4. Перевірити перемикання між типами контенту (regular/special/temporary)

#### Кешування та продуктивність:
5. Перевірити швидкість завантаження після першого разу
6. Протестувати роботу без інтернету (кеш)
7. Перевірити збереження фільтрів між сесіями
8. Протестувати автоматичне очищення кеша

#### UX елементи:
9. Відкрити повноекранний перегляд фото
10. Протестувати скрол-завантаження та пагінацію
11. Перевірити індикатори статусів фото
12. Протестувати відправку пакетів фото

### Автоматизоване тестування:

```typescript
// Приклад тест кейсів
describe('MediaGallery', () => {
  test('should load photos from cache first', () => {
    // Перевірка пріоритету кеша над API
  });

  test('should handle different media types', () => {
    // Тестування фільтрів по типу медіа
  });

  test('should update photo statuses correctly', () => {
    // Тестування системи статусів
  });

  test('should handle network errors gracefully', () => {
    // Тестування обробки помилок
  });
});
```

### Edge cases:
- **Порожня галерея:** коли немає фото взагалі
- **Мережеві помилки:** втрата інтернету під час завантаження
- **Великі галереї:** 1000+ фото з різними фільтрами
- **Конфлікт кешу:** одночасні оновлення від різних джерел
- **Переповнення пам'яті:** занадто багато фото в кеші
- **Невалідні дані:** пошкоджені відповіді від API
- **Швидкі переключення:** між фільтрами та типами контенту
- **Паралельні запити:** одночасне завантаження різних типів даних

### Performance benchmarks:
- **Завантаження з кеша:** < 100ms
- **Перше завантаження:** < 2s для 50 фото
- **Скрол завантаження:** < 500ms для додаткових 50 фото
- **Повноекранний перегляд:** миттєвий перехід
- **Зміна фільтрів:** < 200ms

## Майбутні покращення

### Високий пріоритет (рекомендовано):
1. **React Query/SWR** - заміна власного кешування на професійну бібліотеку
2. **Service Worker** - офлайн підтримка та background sync
3. **WebP/AVIF** - сучасні формати зображень для швидшого завантаження
4. **Virtual scrolling** - для галерей з 10k+ фото
5. **Image optimization** - автоматичне стиснення та форматування

### Середній пріоритет:
6. **Advanced search** - пошук по тегам, описам, датам
7. **Bulk operations** - масове видалення, переміщення, експорт
8. **Drag & drop upload** - завантаження нових фото через drag & drop
9. **Photo editor** - базові інструменти редагування (crop, filters)
10. **Collections** - створення та управління альбомами

### Низький пріоритет (nice-to-have):
11. **AI-powered tagging** - автоматичне визначення контенту
12. **Photo sharing** - експорт та імпорт галерей
13. **Advanced filters** - за кольором, об'єктами, емоціями
14. **Collaboration** - спільне редагування галерей
15. **Analytics** - статистика використання та популярності

### Технічний борг:
- **Unit tests** - покриття компонента тестами
- **E2E tests** - сценарії повного користувацького флоу
- **Performance monitoring** - метрики завантаження та використання
- **Accessibility** - підтримка екранних читачів та клавіатури
- **Type safety** - повна типізація всіх edge cases

---

**Версія документації:** 2.0.0  
**Версія компонента:** 3.2.0  
**Останнє оновлення:** Грудень 2025  
**Автор:** AnChat Team  
**Сумісність:** React 18+, Next.js 15+, TypeScript 5+
