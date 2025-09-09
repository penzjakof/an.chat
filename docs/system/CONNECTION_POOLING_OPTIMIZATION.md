# Connection Pooling Оптимізація

## 🎯 Проблеми що були вирішені

### ❌ **До оптимізації:**
1. **Нові TCP з'єднання** для кожного HTTP запиту
2. **Повільний handshake** - SSL/TLS negotiation для кожного запиту
3. **Високий overhead** - встановлення та закриття сокетів
4. **Неефективне використання ресурсів** - відсутність переваги keep-alive
5. **Затримки мережі** - додатковий RTT для кожного запиту

### ✅ **Після оптимізації:**
1. **Connection reuse** - переваги keep-alive з'єднань
2. **Швидкі запити** - уникнення SSL handshake
3. **Оптимізовані ресурси** - контрольоване використання сокетів
4. **Масштабованість** - підтримка concurrent запитів
5. **Моніторинг** - реальний час статистики pool

## 🚀 Впроваджені компоненти

### **1. ConnectionPoolService**
```typescript
// Конфігурація connection pool
{
  maxSockets: 50,           // Максимум сокетів на хост
  maxFreeSockets: 10,       // Максимум вільних сокетів
  timeout: 30000,           // 30 секунд timeout
  keepAlive: true,          // Включити keep-alive
  keepAliveMsecs: 30000,    // 30 секунд keep-alive
  maxCachedSessions: 100    // Кеш TLS сесій
}
```

**Використання**: Глобальний сервіс для управління HTTP/HTTPS агентами

### **2. TalkyTimesProvider.fetchWithConnectionPool()**
```typescript
private async fetchWithConnectionPool(
  url: string, 
  options: RequestInit & RetryOptions = {}
): Promise<Response>
```

**Функції**:
- ✅ **Connection pooling** з HTTP/HTTPS агентами
- ✅ **Retry логіка** з exponential backoff
- ✅ **Timeout handling** з AbortController
- ✅ **Jitter** для уникнення thundering herd

### **3. HTTP Monitoring Endpoints**

#### **GET /api/http/pool-stats**
```json
{
  "success": true,
  "data": {
    "https": {
      "maxSockets": 50,
      "sockets": 5,
      "freeSockets": 3,
      "requests": 0
    },
    "totalActiveSockets": 5,
    "totalFreeSockets": 3,
    "efficiency": {
      "reuseRatio": 0.375,
      "loadFactor": 0.1
    }
  }
}
```

#### **GET /api/http/pool-health**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "status": "healthy",
    "metrics": {
      "activeSockets": 5,
      "pendingRequests": 0,
      "freeSocketsAvailable": 3
    }
  }
}
```

## 📊 Очікувані результати

### **Продуктивність:**
- **50-70% швидше** HTTP запити (уникнення handshake)
- **Зменшення CPU usage** на 30-40%
- **Зменшення memory overhead** на 20-30%

### **Мережа:**
- **Зменшення RTT** - переваги keep-alive
- **Менше TCP connections** - ефективне переваги
- **Стабільніші з'єднання** - менше connection drops

### **Масштабованість:**
- **Підтримка 50 concurrent** запитів до TalkyTimes
- **Контрольоване використання** сокетів
- **Graceful degradation** при перевантаженні

## 🔧 Конфігурація

### **Environment Variables:**
```bash
# Connection pool не потребує додаткових env vars
# Використовує існуючі TT_BASE_URL
```

### **Налаштування в коді:**
```typescript
// apps/server/src/common/http/connection-pool.service.ts
const config: ConnectionPoolConfig = {
  maxSockets: 50,        // Збільшити для більшого навантаження
  maxFreeSockets: 10,    // Збільшити для кращого reuse
  keepAliveMsecs: 30000, // Збільшити для довших сесій
};
```

## 🚨 Моніторинг та Алерти

### **Ключові метрики:**
- `totalActiveSockets` - поточні активні з'єднання
- `totalFreeSockets` - доступні для переваги
- `totalPendingRequests` - запити в черзі
- `reuseRatio` - ефективність переваги з'єднань

### **Алерти:**
- ⚠️ `activeSockets > 45` - високе навантаження
- ⚠️ `pendingRequests > 10` - черга запитів
- ⚠️ `reuseRatio < 0.3` - низька ефективність

## 🔄 Інтеграція

### **Автоматичне використання:**
Всі HTTP запити в `TalkyTimesProvider` тепер автоматично використовують connection pool:

```typescript
// Старий код (deprecated)
await fetchWithTimeoutAndRetry(url, options);

// Новий код (з connection pooling)
await this.fetchWithConnectionPool(url, options);
```

### **Backward Compatibility:**
Стара функція `fetchWithTimeout` залишається для сумісності, але не використовує connection pool.

## 🧪 Тестування

### **Перевірка роботи:**
```bash
# Статистика connection pool
curl http://localhost:4000/api/http/pool-stats

# Здоров'я connection pool
curl http://localhost:4000/api/http/pool-health
```

### **Load Testing:**
```bash
# Тест concurrent запитів
for i in {1..20}; do
  curl -s http://localhost:4000/api/chats/dialogs &
done
wait

# Перевірка ефективності
curl http://localhost:4000/api/http/pool-stats
```

## 📈 Майбутні покращення

1. **Redis Connection Pool** - для розподілених систем
2. **Circuit Breaker** - інтеграція з connection pool
3. **Adaptive Pool Size** - динамічне налаштування розміру
4. **Connection Warmup** - попереднє встановлення з'єднань
5. **Metrics Export** - інтеграція з Prometheus/Grafana
