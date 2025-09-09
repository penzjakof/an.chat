## TalkyTimes інтеграція (поточний стан)

- Провайдер `TalkyTimesProvider` підтримує мок-режим, якщо не задано `TT_BASE_URL`.
- Аутентифікація до AnChat: лише через Bearer JWT (внутрішні ендпоінти). До TT — через cookies (tld-token, tu_auth, інше).
- Заголовок `x-requested-with` встановлюється ДИНАМІЧНО: якщо у оператора є активна зміна для профілю — у всі запити до TT підставляється його реф-код; якщо активної зміни немає — заголовок не додається.
- Заголовок `x-gateway` не використовується для TT API (тільки внутрішній контекст).

### Базова автентифікація/заголовки (TT)
- Cookies: `tld-token=...; tu_auth=...` (та інші браузерні cookie, якщо повернені сайтом)
- Обовʼязкові headers для більшості POST: `Content-Type: application/json`, `Accept: application/json`
- Referer: коректний referer залежно від ресурсу (див. нижче)
- Додатково за потреби: `x-grpc-web`, `x-user-agent`, `sentry-trace` (для gRPC-Web викликів)

### Використані TT Endpoints (з коду)

Чати та діалоги:
- POST `/platform/chat/dialogs/by-criteria` — отримання списку діалогів (фільтри, пошук)
- POST `/platform/chat/dialogs/by-pairs` — пошук діалогу за парою профіль/клієнт
- GET  `/platform/chat/messages` — історія повідомлень (із курсором)
- POST `/platform/chat/messages` — історія повідомлень (альтернативний шлях із body)
- POST `/platform/chat/send/text` — відправити текст у чат
- POST `/platform/chat/dialog/post` — створити (оформити) пост у діалозі (ексклюзивні пости)

Профілі/оператор:
- GET  `/platform/private/personal-profile` — дані профілю клієнта
- GET  `/platform/connections/profiles` — дані списку клієнтів (профілі)
- GET  `/platform/connection/get` — статуси підключення/блокування (batch)
- GET  `/platform/operator/get-photo/:idRegularUser?preview=...` — отримати оригінал фото за превʼю
- GET  `/platform/operator/get-photos/:clientId` — фото клієнта (публічний профіль)
- POST `/platform/auth/login` — логін (використовується для отримання cookies/token)

Листування (correspondence):
- POST `/platform/correspondence/restriction` — ліміти листів
- POST `/platform/correspondence/emails-history` — історія листування (пагінація)
- POST `/platform/correspondence/video/forbidden-tags` — заборонені категорії для листа
- POST `/platform/correspondence/send-letter` — відправка листа з вкладеннями (images/videos)

Стікері:
- POST `/platform/chat/stickers` — перелік стікерів (за `idInterlocutor`)
- POST `/platform/chat/send/sticker` — відправка стікера (за `idSticker`, `idRegularUser`)

Віртуальні подарунки:
- POST `/platform/virtual-gift/limit/get` — ліміт відправки подарунків
- POST `/platform/virtual-gift/gift/list` — список подарунків (пагінація)
- POST `/platform/virtual-gift/send` — відправка подарунку

Галерея:
- POST `/platform/gallery/photo/list` — фото (пагінація, статуси: approved/approved_by_ai, теги)
- POST `/platform/gallery/photo/connection/list` — статуси фото (`accessed`/`sent`/`null`)
- POST `/platform/chat/send/gallery-photos` — відправка фото в чат (батчем)
- POST `/platform/gallery/video/list` — відео (пагінація, статуси)
- POST `/platform/gallery/video/connection/list` — статуси відео
- POST `/platform/chat/send/gallery-video` — відправка відео
- POST `/platform/gallery/audio/list` — аудіо (пагінація, статуси)
- POST `/platform/gallery/audio/connection/list` — статуси аудіо (TT може повертати `accessed` — трактуємо як `sent` у UI для фільтрації)
- POST `/platform/chat/send/gallery-audio` — відправка аудіо

gRPC-Web (обмеження/рестрикції):
- POST `/platform/core.api.platform.chat.DialogService/GetRestrictions` — визначення доступності ексклюзивних постів і категорій
  - Content-Type: `application/grpc-web+proto`
  - Тіло: gRPC-Web payload (varint `idInterlocutor`)
  - Headers: `x-grpc-web: 1`, `x-user-agent: connect-es/...`
  - Referer: `https://talkytimes.com/chat/<profileId>_<idInterlocutor>`

### Referer правила (ключові):
- Emails history: `https://talkytimes.com/mails/view/<profileId>_<clientId>`
- Unanswered mails: `https://talkytimes.com/mails/inbox/unanswered`
- Forbidden tags: `https://talkytimes.com/user/<clientId>`
- Send letter: `https://talkytimes.com/mails/view/<profileId>_<clientId>`
- Get photo original: `https://talkytimes.com/operator/get-photo/<idRegularUser>?preview=...`
- GetRestrictions (gRPC): `https://talkytimes.com/chat/<profileId>_<idInterlocutor>`

### Обробка помилок/401
- Якщо статус 401 — повертаємо мʼяку помилку/порожні дані та просимо перев-автентифікацію профілю в UI.
- Ретраї: для мережевих/5xx/429/408 — з exponential backoff та jitter (див. `shouldRetry`, `delay`).

### Заголовки/політики
- Використовуємо мінімальний набір заголовків: `accept`, `content-type`, `cookie` + динамічний `x-requested-with` при активній зміні.
- Для gRPC-Web: додаємо спеціальні заголовки (`x-grpc-web`, `x-user-agent`) згідно прикладів.

### Нотатки
- Всі попередні хардкоди `x-requested-with` видалені — значення підставляється динамічно з активної зміни оператора.
- Частина GET ендпоінтів має дубль POST-викликів у провайдера — використовуємо узгоджений шлях з тілами запитів там, де це прискорює/спрощує роботу.
- Для аудіо TT інколи повертає `accessed` як статус — у UI це відображається під фільтром «sent» (для консистентності).

### Приклади відповідей (спрощено)

Примітка: це репрезентативні приклади, формат і поля можуть дещо відрізнятись у реальних відповідях TT.

1) POST /platform/chat/dialogs/by-criteria
```json
{
  "cursor": "1695304123456",
  "dialogs": [
    {
      "idUser": 7162437,
      "idInterlocutor": 127073512,
      "dateUpdated": "2025-09-09T18:57:01Z",
      "is_online": true,
      "messagesLeft": 3,
      "lastMessage": { "id": 43265897921, "type": "message", "content": { "message": "Hi" } }
    }
  ],
  "hasMore": true
}
```

2) GET/POST /platform/chat/messages
```json
{
  "cursor": "43265897921",
  "messages": [
    { "id": 43265897910, "idUserFrom": 7162437, "idUserTo": 127073512, "type": "message", "content": { "message": "Hello" }, "dateCreated": "2025-09-09T18:10:00Z" },
    { "id": 43265897921, "idUserFrom": 127073512, "idUserTo": 7162437, "type": "photo",   "content": { "url": "https://.../p.jpg" }, "dateCreated": "2025-09-09T18:57:00Z" }
  ],
  "hasMore": false
}
```

3) POST /platform/chat/send/text
```json
{ "success": true, "idMessage": 43265898001 }
```

4) POST /platform/correspondence/emails-history
```json
{
  "history": [
    {
      "id": "e-1001",
      "id_user_from": "7162437",
      "id_user_to": "127073512",
      "title": "Re: Photos",
      "content": "Thanks!",
      "date_created": "2025-09-09T18:00:00Z",
      "attachments": { "images": [ { "id": "p1", "url_thumbnail": "https://.../t.jpg", "url_original": "https://.../o.jpg" } ] }
    }
  ],
  "page": 1,
  "limit": 10
}
```

5) POST /platform/correspondence/send-letter
```json
{ "success": true, "idMessage": 987654321 }
```

6) POST /platform/correspondence/video/forbidden-tags
```json
{ "success": true, "tags": ["special", "special_plus"] }
```

7) POST /platform/chat/stickers
```json
{
  "categories": [
    { "name": "Funny Faces", "stickers": [ { "id": 1001, "url": "https://i.gstatvb.com/sticker_1001.jpg" } ] }
  ]
}
```

8) POST /platform/chat/send/sticker
```json
{ "success": true, "idMessage": 555000111 }
```

9) POST /platform/virtual-gift/limit/get
```json
{ "limit": 13, "canSendWithoutLimit": false }
```

10) POST /platform/virtual-gift/gift/list
```json
{
  "cursor": "35",
  "items": [ { "id": 1180, "cost": 3340, "name": "Ocean diamond", "imageSrc": "https://...", "animationSrc": null, "category": { "id": 74, "name": "Labor Day" }, "gender": "female" } ]
}
```

11) POST /platform/virtual-gift/send
```json
{ "success": true, "timestamp": "2025-01-15T10:30:00Z" }
```

12) POST /platform/gallery/photo/list
```json
{
  "cursor": "49590541",
  "photos": [
    {
      "idPhoto": 49938731,
      "idUser": 117326723,
      "status": { "code": "approved_by_ai", "description": "Approved by AI" },
      "tags": [ { "code": "special", "description": "Special" }, { "code": "temporary", "description": "Temporary" } ],
      "urls": { "urlOriginal": "https://...", "urlPreview": "https://...", "urlStandard": "https://..." },
      "canDisagree": false,
      "declineReasons": [],
      "comment": ""
    }
  ],
  "hasMore": true,
  "totalCount": 150
}
```

13) POST /platform/gallery/photo/connection/list
```json
{
  "statuses": {
    "51496050": "accessed",
    "51496049": "sent"
  }
}
```

14) POST /platform/gallery/video/list
```json
{ "cursor": "v-100", "videos": [ { "idVideo": 9001, "idUser": 117326723, "duration": 42, "urls": { "urlMp4Hd": "https://...", "urlMp4Sd": "https://...", "urlThumbnail": "https://..." } } ] }
```

15) POST /platform/gallery/audio/list
```json
{ "cursor": "a-50", "items": [ { "id": 7001, "idUser": 117326723, "status": "approved", "title": "voice_001.mp3", "duration": 17, "urls": { "mp3": "https://.../1.mp3", "ogg": "https://.../1.ogg" } } ] }
```

16) POST /platform/core.api.platform.chat.DialogService/GetRestrictions (gRPC-Web)
```json
{
  "hasExclusivePosts": true,
  "categories": ["erotic", "special", "special_plus", "limited"],
  "hasExtendedTags": true
}
```

17) GET /platform/connection/get
```json
{
  "results": [
    { "idInterlocutor": 127073512, "blockedByInterlocutor": false, "isConnected": true },
    { "idInterlocutor": 119308595, "blockedByInterlocutor": true,  "isConnected": false }
  ]
}
```

18) POST /platform/auth/login
```json
{ "result": true, "idUser": 7162437, "refreshToken": "2d816c7b51deb0..." }
```


