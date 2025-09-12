# 🎁 Virtual Gifts - Документація

## Огляд

Virtual Gifts - це повнофункціональна система віртуальних подарунків для AnChat додатку, яка дозволяє користувачам надсилати анімовані подарунки в чаті. Система інтегрується з TalkyTimes API та підтримує як статичні зображення, так і Lottie анімації.

## Архітектура системи

### 🎯 Ключові компоненти

#### Frontend (React/Next.js)
```
apps/web/src/app/chats/[dialogId]/page.tsx
├── Стан управління подарунками:
│   ├── giftLimit - ліміти відправки
│   ├── giftItems[] - список доступних подарунків
│   ├── isGiftModalOpen - стан головного модального вікна
│   ├── selectedGift - вибраний подарунок для відправки
│   ├── isMessageModalOpen - модальне вікно повідомлення
│   ├── giftMessage - текст повідомлення до подарунку
│   └── isSendingGift - стан процесу відправки
├── Функції управління:
│   ├── loadGiftLimits() - завантаження лімітів
│   ├── loadGifts() - завантаження списку подарунків
│   ├── handleGiftSelect() - вибір подарунку
│   ├── handleSendGift() - відправка подарунку
│   ├── cleanupLottieAnimations() - очистка Lottie інстансів
│   └── loadLottieForElement() - завантаження Lottie для елемента
└── UI компоненти:
    ├── Modal для списку подарунків
    ├── Modal для введення повідомлення
    └── LottieErrorBoundary для обробки помилок
```

#### Backend (NestJS)
```
apps/server/src/
├── profiles/
│   ├── profiles.controller.ts    # REST API endpoints
│   ├── profiles.service.ts       # Бізнес логіка
│   └── profiles.module.ts        # Конфігурація модуля
└── providers/talkytimes/
    ├── talkytimes.provider.ts    # TalkyTimes API інтеграція
    └── talkytimes.module.ts      # Конфігурація провайдера
```

## 🔧 Технічні деталі

### Типи даних

```typescript
// Основні інтерфейси
type VirtualGiftLimit = {
  limit: number;                    // Кількість доступних подарунків
  canSendWithoutLimit: boolean;     // Чи можна надсилати без обмежень
};

type VirtualGiftItem = {
  id: number;                       // Унікальний ID подарунку
  cost: number;                     // Вартість у монетах
  name: string;                     // Назва подарунку
  imageSrc: string | null;          // URL статичного зображення
  animationSrc: string | null;      // URL анімації (JSON або GIF)
  category: VirtualGiftCategory;    // Категорія подарунку
  gender: string | null;           // Гендерна прив'язка
};

type VirtualGiftCategory = {
  id: number;                       // ID категорії
  name: string;                     // Назва категорії
};

type VirtualGiftListResponse = {
  cursor: string;                   // Курсор для пагінації
  items: VirtualGiftItem[];         // Масив подарунків
};
```

### Система станів

```typescript
// Управління станом подарунків
const [giftLimit, setGiftLimit] = useState<VirtualGiftLimit | null>(null);
const [isLoadingGiftLimit, setIsLoadingGiftLimit] = useState(false);
const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
const [giftItems, setGiftItems] = useState<VirtualGiftItem[]>([]);
const [isLoadingGifts, setIsLoadingGifts] = useState(false);
const [giftCursor, setGiftCursor] = useState<string>('');
const [hasMoreGifts, setHasMoreGifts] = useState(true);

// Стан відправки подарунків
const [selectedGift, setSelectedGift] = useState<VirtualGiftItem | null>(null);
const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
const [giftMessage, setGiftMessage] = useState('');
const [isSendingGift, setIsSendingGift] = useState(false);

// Захист від race condition
const isLoadingGiftsRef = useRef(false);
const abortControllerRef = useRef<AbortController | null>(null);

// Управління Lottie анімаціями
const activeLottieInstances = useRef<Map<string, any>>(new Map());
```

## 🚀 API Endpoints

### POST `/api/profiles/:id/gift-limits`
Отримання лімітів відправки подарунків для профілю

**Параметри:**
- `id` (string) - ID профілю
- `clientId` (number) - ID клієнта

**Відповідь:**
```json
{
  "success": true,
  "data": {
    "limit": 13,
    "canSendWithoutLimit": false
  }
}
```

### GET `/api/profiles/:id/gift-list` (якщо додасте окремий endpoint) / Наразі — використовується внутрішній провайдер без прямого REST ендпоінта.
Отримання списку доступних подарунків з пагінацією

**Параметри:**
- `id` (string) - ID профілю
- `clientId` (number) - ID клієнта
- `cursor` (string, optional) - Курсор для пагінації
- `limit` (number, optional) - Кількість елементів (default: 30)

**Відповідь:**
```json
{
  "success": true,
  "data": {
    "cursor": "35",
    "items": [
      {
        "id": 1180,
        "cost": 3340,
        "name": "Ocean diamond",
        "imageSrc": "https://i.gstatvb.com/...",
        "animationSrc": null,
        "category": { "id": 74, "name": "Labor Day in the U.S." },
        "gender": "female"
      }
    ]
  }
}
```

### POST `/api/profiles/:id/send-gift` (якщо додасте окремий endpoint) / Наразі — відправка через `TalkyTimesProvider.sendVirtualGift()` із ProfilesService/Controller викликів немає.
Відправка подарунку клієнту

**Параметри:**
- `id` (string) - ID профілю
- `clientId` (number) - ID клієнта
- `giftId` (number) - ID подарунку
- `message` (string, optional) - Повідомлення до подарунку

**Відповідь:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Подарунок успішно відправлено!",
    "giftId": 1180,
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

## 🎨 UI/UX Дизайн

### Модальні вікна

#### 1. Головне модальне вікно подарунків
```
┌─────────────────────────────────────────────────┐
│ 🎁 Віртуальні подарунки          ✕             │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🧪 Тест завантаження:                          │
│ [test images]                                   │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💖 Loading...                              │ │
│ │ Grid of gifts (2-5 columns responsive)      │ │
│ │                                             │ │
│ │ 🎭 Lottie animation preview                │ │
│ │ 💎 Static image preview                    │ │
│ │ 🔄 Load more button                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### 2. Модальне вікно відправки
```
┌─────────────────────────────────────────────────┐
│ 📤 Надіслати подарунок            ✕           │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🎁 Selected gift preview                   │ │
│ │ 💎 Gift image/animation                    │ │
│ │ Gift name: "Ocean diamond"                 │ │
│ │ Cost: ⭐ 3340                              │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📝 Особисте повідомлення:                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ Напишіть тепле повідомлення...             │ │
│ │ (max 200 characters)                       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Відмінити]                    [Надіслати]     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Адаптивність

```css
/* Responsive grid */
.grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5

/* Modal sizing */
max-w-md (message modal)
max-w-4xl (gifts modal)
max-h-[80vh] (both)

/* Mobile optimization */
p-4 (mobile padding)
w-full max-w-md (mobile width)
```

## 🔄 Логіка роботи

### 1. Завантаження лімітів

```typescript
// Автоматичне завантаження при відкритті чату
useEffect(() => {
  if (sourceProfile?.id && !isLoadingGiftLimit && !giftLimit) {
    loadGiftLimits();
  }
}, [sourceProfile?.id, isLoadingGiftLimit, giftLimit]);

const loadGiftLimits = async () => {
  try {
    setIsLoadingGiftLimit(true);
    const response = await apiPost('/profiles/${profileId}/gift-limits', {
      clientId: idRegularUser
    });

    if (response.success && response.data) {
      setGiftLimit(response.data);
    }
  } catch (error) {
    console.error('Failed to load gift limits:', error);
  } finally {
    setIsLoadingGiftLimit(false);
  }
};
```

### 2. Завантаження списку подарунків

```typescript
const loadGifts = async (isInitial = true) => {
  // Захист від race condition
  if (isLoadingGiftsRef.current) {
    return;
  }

  // Скасування попереднього запиту
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  const abortController = new AbortController();
  abortControllerRef.current = abortController;

  try {
    isLoadingGiftsRef.current = true;
    // ... завантаження даних з підтримкою AbortController
  } catch (error) {
    if (error.name !== 'AbortError') {
      // Обробка справжніх помилок
    }
  } finally {
    isLoadingGiftsRef.current = false;
    abortControllerRef.current = null;
  }
};
```

### 3. Відправка подарунку

```typescript
const handleSendGift = async () => {
  if (!selectedGift || !sourceProfile?.id) return;

  try {
    setIsSendingGift(true);

    const response = await apiPost('/profiles/${profileId}/send-gift', {
      clientId: idRegularUser,
      giftId: selectedGift.id,
      message: giftMessage
    });

    if (response.success) {
      toast.success(`🎁 Подарунок "${selectedGift.name}" відправлено!`);
      // Закриття модальних вікон та очищення стану
      setIsMessageModalOpen(false);
      setSelectedGift(null);
      setGiftMessage('');
      loadGiftLimits(); // Оновлення лімітів
    }
  } catch (error) {
    toast.error('❌ Помилка відправки подарунку');
  } finally {
    setIsSendingGift(false);
  }
};
```

## 🎭 Lottie Анімації

### Підтримувані формати

1. **JSON Lottie анімації** - повноцінні векторні анімації
2. **GIF анімації** - растрові анімації
3. **Статичні зображення** - PNG/JPG як fallback

### Система завантаження

```typescript
const loadLottieForElement = async (container: HTMLElement, gift: VirtualGiftItem) => {
  try {
    // 1. Завантаження Lottie бібліотеки
    if (!window.lottie) {
      await loadLottieLibrary();
    }

    // 2. Завантаження анімаційних даних
    const response = await fetch(gift.animationSrc);
    const data = await response.json();

    // 3. Створення анімації
    const animation = window.lottie.loadAnimation({
      container,
      animationData: data,
      renderer: 'svg',
      loop: true,
      autoplay: true
    });

    // 4. Збереження інстансу для cleanup
    activeLottieInstances.current.set(gift.id + '-' + Date.now(), animation);

  } catch (error) {
    // Fallback на статичне зображення
    showLottieFallback(container, gift);
  }
};
```

### Управління пам'яттю

```typescript
// Cleanup при закритті модальних вікон
useEffect(() => {
  if (!isGiftModalOpen && !isMessageModalOpen) {
    cleanupLottieAnimations();
    cleanupActiveRequests();
  }
}, [isGiftModalOpen, isMessageModalOpen]);

const cleanupLottieAnimations = () => {
  activeLottieInstances.current.forEach((animation, key) => {
    if (animation?.destroy) {
      animation.destroy();
    }
  });
  activeLottieInstances.current.clear();
};
```

## 🛡️ Error Boundary

```typescript
class LottieErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🎭 Lottie Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fallback-ui">
          <span>🎭</span>
          <span>Lottie помилка</span>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## 🔧 TalkyTimes Інтеграція

### Основні Endpoints

#### `/platform/virtual-gift/limit/get`
```typescript
// Запит
{
  idUserFrom: 7162437,
  idUserTo: 119308595
}

// Відповідь
{
  limit: 13,
  canSendWithoutLimit: false
}
```

#### `/platform/virtual-gift/gift/list`
```typescript
// Запит
{
  limit: 30,
  cursor: "",
  idRegularUser: 119308595
}

// Відповідь
{
  cursor: "35",
  items: [
    {
      id: 1180,
      cost: 3340,
      name: "Ocean diamond",
      imageSrc: "https://i.gstatvb.com/...",
      animationSrc: null,
      category: { id: 74, name: "Labor Day" },
      gender: "female"
    }
  ]
}
```

#### `/platform/virtual-gift/send`
```typescript
// Запит
{
  idUserTo: 119308595,
  idGift: 789,
  message: "kiss"
}

// Відповідь
{
  success: true,
  timestamp: "2025-01-15T10:30:00Z"
}
```

### Автентифікація
- Використовує TalkyTimes сесії через cookies
- Автоматичне поновлення сесій при 401 помилці
- Headers з user-agent та referer для імітації браузера

## 📊 Продуктивність та оптимізації

### Кешування
```typescript
// Ліміти кешуються на рівні компонента
// Список подарунків не кешується (динамічний)
// Lottie файли не кешуються (занадто великі)
```

### Оптимізації завантаження
- **Lazy loading** для Lottie анімацій
- **AbortController** для скасування застарілих запитів
- **Intersection Observer** можна додати для lazy loading grid
- **Virtual scrolling** для великих списків подарунків

### Memory Management
```typescript
// Cleanup Lottie інстансів при unmount
useEffect(() => {
  return () => {
    cleanupLottieAnimations();
  };
}, []);

// Cleanup при закритті модальних вікон
useEffect(() => {
  if (!isGiftModalOpen && !isMessageModalOpen) {
    cleanupLottieAnimations();
    cleanupActiveRequests();
  }
}, [isGiftModalOpen, isMessageModalOpen]);
```

## 🐛 Помилки та їх вирішення

### 1. Race Condition в завантаженні
```typescript
// Помилка: Послідовні виклики loadGifts() перекривають один одного
// Рішення: isLoadingGiftsRef + AbortController
```

### 2. Memory Leaks в Lottie
```typescript
// Помилка: Lottie інстанси не знищуються
// Рішення: cleanupLottieAnimations() + Map для tracking
```

### 3. Parsing Error з template literals
```typescript
// Помилка: ${gift.id} в dangerouslySetInnerHTML
// Рішення: Заміна на звичайну конкатенацію рядків
```

### 4. Type Safety
```typescript
// Помилка: imageSrc може бути null
// Рішення: VirtualGiftItem з правильною типізацією
```

## 🧪 Тестування

### Unit Tests
```typescript
describe('Virtual Gifts', () => {
  test('should handle gift selection', () => {
    // Тестування вибору подарунку
  });

  test('should send gift with message', () => {
    // Тестування відправки з повідомленням
  });

  test('should cleanup Lottie animations', () => {
    // Тестування cleanup функцій
  });
});
```

### E2E Tests
```typescript
// Тестування повного флоу:
// 1. Відкриття модального вікна
// 2. Вибір подарунку
// 3. Введення повідомлення
// 4. Відправка
// 5. Закриття та cleanup
```

## 🔮 Майбутні покращення

### Високий пріоритет
1. **React Query/SWR** - заміна власного стану на професійну бібліотеку
2. **Service Worker** - кешування Lottie файлів
3. **Virtual scrolling** - для великих списків подарунків
4. **Optimistic updates** - негайний UI feedback

### Середній пріоритет
5. **Пошук подарунків** - за назвою та категорією
6. **Улюблені подарунки** - система закладок
7. **Історія відправки** - перегляд надісланих подарунків
8. **Пакетна відправка** - кілька подарунків одночасно

### Низький пріоритет
9. **Персоналізація** - рекомендації на основі історії
10. **Статистика** - аналітика використання подарунків
11. **A/B тестування** - оптимізація конверсії

---

## 📋 API Reference

### Frontend функції

| Функція | Опис | Параметри |
|---------|------|-----------|
| `loadGiftLimits()` | Завантаження лімітів | - |
| `loadGifts(isInitial)` | Завантаження списку | isInitial: boolean |
| `handleGiftSelect(gift)` | Вибір подарунку | gift: VirtualGiftItem |
| `handleSendGift()` | Відправка подарунку | - |
| `cleanupLottieAnimations()` | Очистка анімацій | - |

### Backend методи

| Метод | Endpoint | Опис |
|-------|----------|------|
| `getGiftLimits()` | GET /gift-limits | Отримання лімітів |
| `getGiftList()` | GET /gift-list | Отримання списку |
| `sendGift()` | POST /send-gift | Відправка подарунку |

### TalkyTimes методи

| Метод | Endpoint | Опис |
|-------|----------|------|
| `getVirtualGiftLimits()` | /limit/get | Ліміти відправки |
| `getVirtualGiftList()` | /gift/list | Список подарунків |
| `sendVirtualGift()` | /send | Відправка подарунку |

---

**Версія документації:** 1.0.0  
**Версія системи:** 2.1.0  
**Останнє оновлення:** Січень 2025  
**Автор:** AnChat Team  
**Сумісність:** React 18+, Next.js 15+, NestJS 10+, TypeScript 5+
