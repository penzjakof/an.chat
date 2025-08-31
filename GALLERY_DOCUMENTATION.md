# 📸 MediaGallery - Документація

## Огляд
MediaGallery - це повнофункціональний компонент для відображення та управління фото в AnChat додатку. Компонент інтегрується з TalkyTimes API для завантаження фото та їх відправки в чат.

## Основні функції

### ✨ Ключові можливості
- 📱 Адаптивна сітка 5x∞ з lazy loading
- 🔥 Візуальні індикатори для special фото (fire іконка)
- 🎯 Розділи "Доступні" та "Special" в контексті чату
- 🚀 Автоматичне довантаження при недостатній кількості фото (< 15)
- 📜 Завантаження через скрол без кнопок
- 📤 Відправка фото безпосередньо в чат
- 🎨 Сірі фільтри для недоступних фото
- ⚡ Оптимізована продуктивність з мемоізацією

## Архітектура

### Frontend (React/Next.js)
```
apps/web/src/components/MediaGallery.tsx
├── Інтерфейси (Photo, PhotoTag, PhotoUrls, etc.)
├── Хуки та стан управління
├── Мемоізовані функції для оптимізації
├── Автоматичне завантаження логіка
└── UI компоненти та стилізація
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
Отримання списку фото з пагінацією

**Параметри:**
- `profileId` (string) - ID профілю
- `cursor` (string, optional) - Курсор для пагінації
- `limit` (string, optional) - Кількість фото (default: 50)
- `statuses` (string, optional) - Статуси фото (approved,approved_by_ai)

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
        "tags": [{ "code": "special", "description": "Special" }],
        "urls": {
          "urlOriginal": "https://...",
          "urlPreview": "https://...",
          "urlStandard": "https://..."
        },
        "canDisagree": false,
        "comment": "",
        "declineReasons": []
      }
    ]
  }
}
```

### POST `/api/gallery/send-photos`
Відправка фото в чат

**Body:**
```json
{
  "idsGalleryPhotos": [51496050, 51496049],
  "idRegularUser": 26504239,
  "profileId": 7162437
}
```

**Відповідь:**
```json
{
  "success": true
}
```

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

## Props

| Prop | Тип | Обов'язковий | Опис |
|------|-----|-------------|------|
| `profileId` | string | ✅ | ID профілю для завантаження фото |
| `isOpen` | boolean | ✅ | Стан відкриття галереї |
| `onClose` | () => void | ✅ | Callback для закриття галереї |
| `onPhotoSelect` | (photos: Photo[]) => void | ✅ | Callback для вибору фото |
| `maxSelection` | number | ❌ | Максимальна кількість вибраних фото (default: 6) |
| `context` | 'chat' \| 'profile' \| 'other' | ❌ | Контекст використання (default: 'other') |
| `idRegularUser` | number | ❌ | ID користувача для відправки в чат (обов'язковий для context='chat') |

## Логіка роботи

### Контекст "chat"
1. **Розділи фото:**
   - "Доступні": звичайні фото без special тегів (селектабельні)
   - "Special": фото з тегами special/special_plus (неселектабельні, сірі)

2. **Автоматичне довантаження:**
   - Якщо в розділі < 15 фото → автоматично завантажує ще
   - Максимум 3 спроби з затримкою 1 секунда
   - Зупиняється при пустій відповіді від TalkyTimes

3. **Відправка фото:**
   - Через TalkyTimes API `/platform/chat/send/gallery-photos`
   - Автоматичне закриття галереї після успішної відправки

### Контекст "other"/"profile"
- Показує всі фото без розділів
- Всі фото селектабельні
- Використовує callback `onPhotoSelect` замість API відправки

## Оптимізації

### Продуктивність
- **Мемоізація:** `useMemo` для фільтрації фото та `useCallback` для функцій
- **Set lookup:** O(1) перевірка вибраних фото замість O(n)
- **Debounce:** Обмеження частоти scroll events (200ms)
- **Cleanup:** Запобігання витокам пам'яті в useEffect

### UX оптимізації
- **Lazy loading:** `loading="lazy"` для зображень
- **Skeleton states:** Анімація завантаження
- **Error handling:** Graceful fallback при помилках
- **Валідація:** Перевірка props та API параметрів

## TalkyTimes інтеграція

### Endpoints використовувані:
- `POST /platform/gallery/photo/list` - Отримання фото
- `POST /platform/chat/send/gallery-photos` - Відправка в чат

### Автентифікація:
- Використовує TalkyTimes сесії напряму
- Не потребує внутрішнього JWT токена
- `@Public()` декоратор на галерея endpoints

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

1. **"No active session found for profile 0"**
   - Причина: Неправильний profileId в API запиті
   - Рішення: Передавати правильний profileId з props

2. **Дублікати ключів React**
   - Причина: Повторне додавання тих же фото
   - Рішення: Дедуплікація через Set в loadPhotos

3. **Циклічне завантаження**
   - Причина: Пуста відповідь від TalkyTimes
   - Рішення: Перевірка hasMore та кількості нових фото

4. **Витоки пам'яті**
   - Причина: Незакриті timeout та event listeners
   - Рішення: Cleanup в useEffect return функціях

## Тестування

### Ручне тестування:
1. Відкрити галерею в чаті
2. Перевірити розділи "Доступні" та "Special"
3. Протестувати автоматичне довантаження
4. Вибрати фото та відправити
5. Перевірити скрол-завантаження

### Edge cases:
- Пуста відповідь від TalkyTimes
- Мережеві помилки
- Невалідні props
- Швидке переключення між розділами

## Майбутні покращення

### Рекомендовані оптимізації:
1. **Віртуалізація** для великих списків (react-window)
2. **WebP підтримка** для кращого стиснення
3. **Intersection Observer** для точнішого lazy loading
4. **React Query** для кешування API відповідей
5. **Error Boundary** для graceful error handling

### Нові функції:
- Пошук по фото
- Фільтри по датам
- Bulk операції
- Drag & drop upload
- Повноекранний перегляд

---

**Версія:** 1.0.0  
**Останнє оновлення:** Січень 2025  
**Автор:** AnChat Team
