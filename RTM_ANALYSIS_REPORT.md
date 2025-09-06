# 📊 Детальний звіт аналізу RTM системи та листування

## 📋 Огляд звіту

**Дата аналізу:** 6 вересня 2025  
**Період спостереження:** 11:49:51 - 14:20:21 UTC (2 години 30 хвилин)  
**Джерело даних:** `apps/server/tt-rtm-messages.log`  
**Метод аналізу:** Автоматизований парсинг JSON логів

---

## 📊 ЗАГАЛЬНА СТАТИСТИКА

### Основні показники
- **Загальна кількість записів:** 846
- **Активних профілів:** 2 (`117326723`, `7162437`)
- **Тривалість сесії:** ~2.5 години
- **Середня частота повідомлень:** ~5.7 повідомлень/хвилину

### Розподіл типів повідомлень
| Тип | Кількість | Відсоток |
|-----|-----------|----------|
| Порожні повідомлення | 416 | 49.2% |
| Connect повідомлення | 291 | 34.4% |
| Push повідомлення | 91 | 10.8% |
| Close події | 204 | 24.1% |

---

## 📧 КОРЕСПОНДЕНЦІЯ ТА ЛИСТИ В RTM

### 🎯 ВАЖЛИВИЙ ВИСНОВОК
**Листи повністю інтегровані в RTM систему!** Вони надходять в режимі реального часу через WebSocket з'єднання.

### Знайдені типи correspondence подій:
1. **email** - прямі email повідомлення
2. **platform_CorrespondenceLimitChanged** - зміни лімітів листування
3. **correspondence_AttachmentDisplayAttributesApplied** - відображення прикріплень

---

## 🔍 ДЕТАЛЬНІ ПРИКЛАДИ З ЛОГІВ

### 📧 EMAIL ПОВІДОМЛЕННЯ

#### Приклад 1: Email з фотографією
```json
{
  "timestamp": "2025-09-06T14:11:07.684Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "dateExpired": "2025-09-06T14:13:07Z",
          "email": {
            "content": "<p>hi</p>",
            "countPhotos": 1,
            "countVideos": 0,
            "dateCreated": "2025-09-06T14:11:07+00:00",
            "id": 9092463227,
            "id_correspondence": 3346450183,
            "id_user_from": 127351144,
            "id_user_to": 7162437,
            "title": "hi..."
          },
          "id": "752c8f29-f251-47c6-880a-4173616e9e1a",
          "type": "email"
        },
        "offset": 216267
      }
    }
  }
}
```

**Аналіз структури:**
- `content`: HTML контент листа
- `countPhotos`: 1 (наявність фотографії)
- `id_correspondence`: 3346450183 (ID кореспонденції)
- `id_user_from/to`: відправник/одержувач
- `dateExpired`: час протухання повідомлення

---

### 📎 ATTACHMENT DISPLAY ATTRIBUTES

#### Приклад: Відображення прикріплень до листа
```json
{
  "timestamp": "2025-09-06T14:11:07.875Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "displayAttributes": [],
            "id": 453032010,
            "idLetter": 9092463227
          },
          "dateExpired": null,
          "id": "c19604e0-0394-4152-8025-ba2c962a7d39",
          "type": "correspondence_AttachmentDisplayAttributesApplied"
        },
        "offset": 216269
      }
    }
  }
}
```

**Ключові поля:**
- `idLetter`: 9092463227 (посилання на лист)
- `displayAttributes`: [] (атрибути відображення)
- `id`: 453032010 (ID attachment)

---

### 📊 CORRESPONDENCE LIMIT CHANGES

#### Приклад 1: Зміна лімітів листування
```json
{
  "timestamp": "2025-09-06T14:11:07.650Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "idInterlocutor": 127351144,
            "idUser": 7162437,
            "limitLeft": 2
          },
          "dateExpired": null,
          "id": "acf8bc0f-d2f7-486f-801e-0cd1566ec1bf",
          "type": "platform_CorrespondenceLimitChanged"
        },
        "offset": 216266
      }
    }
  }
}
```

#### Приклад 2: Інший приклад зміни лімітів
```json
{
  "timestamp": "2025-09-06T14:18:46.797Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "idInterlocutor": 127351144,
            "idUser": 7162437,
            "limitLeft": 1
          },
          "dateExpired": null,
          "id": "9e4e428e-7308-4790-8cff-6cfca2cfb267",
          "type": "platform_CorrespondenceLimitChanged"
        },
        "offset": 216280
      }
    }
  }
}
```

---

## 💬 ЗВИЧАЙНІ ПОВІДОМЛЕННЯ ЧАТУ

### LIKE NEWSFEED POST
```json
{
  "timestamp": "2025-09-06T13:18:10.549Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "message": {
              "content": {
                "idFeedPost": 216897833,
                "photos": [{
                  "id": 30514482,
                  "key": "shpzkl1k16040f5i9",
                  "url": "https://i.gstatvb.com/shpzkl1k16040f5i9.r300x300.b34cfbf1.jpg"
                }],
                "photosTotalCount": 1,
                "text": "Not easy to wake me up, but coffee is always welcome."
              },
              "dateCreated": "2025-09-06T13:18:10+00:00",
              "displayAttributes": [],
              "hasTranslation": false,
              "id": 43342655426,
              "idUserFrom": 127209506,
              "idUserTo": 7162437,
              "isReported": false,
              "isTranslation": false,
              "type": "like_newsfeed_post"
            }
          },
          "dateExpired": null,
          "id": "248663da-dbf8-41d1-bb73-2a7ebd6a2cb1",
          "type": "MessageSent"
        },
        "offset": 216233
      }
    }
  }
}
```

### LIKE PHOTO
```json
{
  "timestamp": "2025-09-06T13:13:59.697Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "message": {
              "content": {
                "idPhoto": 1045282738,
                "url": "https://i.gstatvb.com/shpzkl4m5drrhu6kv.r300x300.652a86ab.jpg"
              },
              "dateCreated": "2025-09-06T13:13:59+00:00",
              "displayAttributes": [],
              "hasTranslation": false,
              "id": 43342622743,
              "idUserFrom": 127209506,
              "idUserTo": 7162437,
              "isReported": false,
              "isTranslation": false,
              "type": "likephoto"
            }
          },
          "dateExpired": null,
          "id": "4e0da19d-05ad-4bdc-acb7-97beb5541796",
          "type": "MessageSent"
        },
        "offset": 216227
      }
    }
  }
}
```

---

## 🔗 CONNECT/HEARTBEAT ПОВІДОМЛЕННЯ

### Підключення до RTM
```json
{
  "timestamp": "2025-09-06T11:49:51.375Z",
  "profileId": 117326723,
  "direction": "in",
  "message": {
    "id": 1,
    "connect": {
      "client": "e4ce1b29-c8c1-435a-a40c-5633bdc79d78",
      "version": "5.4.9",
      "subs": {
        "personal:#117326723": {
          "recoverable": true,
          "epoch": "1748336724",
          "offset": 94008,
          "positioned": true
        }
      },
      "ping": 60,
      "pong": true
    }
  }
}
```

### Відключення через відсутність pong
```json
{
  "timestamp": "2025-09-06T11:51:01.904Z",
  "profileId": 117326723,
  "event": "close",
  "code": 3012,
  "reason": "no pong"
}
```

---

## 📈 ЛІМІТИ ПОВІДОМЛЕНЬ

### Зміна лімітів діалогу
```json
{
  "timestamp": "2025-09-06T11:59:26.779Z",
  "profileId": 7162437,
  "direction": "in",
  "message": {
    "push": {
      "channel": "personal:#7162437",
      "pub": {
        "data": {
          "data": {
            "idInterlocutor": 118363483,
            "idUser": 7162437,
            "limitLeft": 0
          },
          "dateExpired": null,
          "id": "fca0b19a-49da-407c-95a1-048c19324b3f",
          "type": "chat_DialogLimitChanged"
        },
        "offset": 216205
      }
    }
  }
}
```

---

## 🎯 ТИПИЗАЦІЯ ВСІХ ЗНАЙДЕНИХ ПОВІДОМЛЕНЬ

### Correspondence (листування):
1. `email` - прямі email повідомлення
2. `platform_CorrespondenceLimitChanged` - зміни лімітів листування
3. `correspondence_AttachmentDisplayAttributesApplied` - відображення прикріплень

### Chat повідомлення:
1. `MessageSent` - відправлені повідомлення
2. `like_newsfeed_post` - вподобання постів
3. `likephoto` - вподобання фото
4. `wink` - підморгування
5. `sticker` - стікери
6. `message` - текстові повідомлення

### Системні події:
1. `chat_DialogLimitChanged` - зміни лімітів чату
2. `chat_MessageDisplayAttributesApplied` - відображення атрибутів повідомлень
3. `chat_MessageRead` - прочитані повідомлення
4. `chat_DialogCreated` - створені діалоги
5. `chat_DialogTyping` - набір тексту
6. `Blocked` - блокування користувача
7. `Unblocked` - розблокування користувача

### Системні повідомлення RTM:
1. `connect` - підключення до RTM
2. `close` - відключення від RTM

---

## 📊 СТАТИСТИКА ПО ТИПАМ

| Тип повідомлення | Кількість | Опис |
|------------------|-----------|------|
| chat_DialogLimitChanged | 20 | Зміни лімітів діалогів |
| chat_MessageDisplayAttributesApplied | 14 | Відображення атрибутів повідомлень |
| chat_MessageRead | 16 | Прочитані повідомлення |
| chat_DialogCreated | 11 | Створені діалоги |
| MessageSent | 17 | Надіслані повідомлення |
| chat_DialogTyping | 4 | Набір тексту |
| platform_CorrespondenceLimitChanged | 4 | Зміни лімітів листування |
| email | 1 | Email повідомлення |
| correspondence_AttachmentDisplayAttributesApplied | 1 | Відображення прикріплень |
| Blocked | 1 | Блокування |
| Unblocked | 1 | Розблокування |

---

## 🔍 ТЕХНІЧНІ ДЕТАЛІ

### Структура каналів:
- `personal:#{profileId}` - персональний канал користувача
- Автоматична підписка при підключенні

### Heartbeat механізм:
- `ping: 60` - інтервал heartbeat в секундах
- Відключення при відсутності pong відповіді

### Offset система:
- Послідовна нумерація повідомлень
- Відновлення з останнього offset при перепідключенні

---

## 🎯 КЛЮЧОВІ ВИСНОВКИ

### 1. **Повна інтеграція листування в RTM**
Листи не є окремим каналом, а повністю інтегровані в RTM систему з власними типами подій.

### 2. **Realtime синхронізація**
Всі зміни лімітів, нові листи та прикріплення надходять в режимі реального часу.

### 3. **Розширена структура даних**
Email повідомлення містять багату мета-інформацію: контент, прикріплення, кореспонденції.

### 4. **Стабільність з'єднання**
Система має механізми автоматичного перепідключення при втратах зв'язку.

---

## 📋 РЕКОМЕНДАЦІЇ

1. **Моніторинг correspondence подій** - відстежувати email та attachment події
2. **Оптимізація heartbeat** - налаштувати інтервали для зменшення навантаження
3. **Кешування лімітів** - використовувати отримані дані про ліміти для UI
4. **Обробка attachment** - правильно відображати прикріплення до листів

---

*Звіт складено на основі аналізу 846 записів RTM логів від 6 вересня 2025 року*
