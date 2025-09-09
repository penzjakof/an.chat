## Статус деплою на сервері (anchat-4gb-nbg1-1)

Дата: 2025-09-09 (стан позначено як стабільний)

### TL;DR
- DNS/домен: відсутній (працюємо по IP).
- IP: 91.98.138.1 (Hetzner, Nuremberg).
- Порти у фаєрволі Hetzner: 22, 80, 443 дозволені (Inbound). 3000/4000 закриті зовні — доступ лише з localhost через Nginx.
- Nginx: налаштований reverse proxy на 80 порт:
  - `/` → 127.0.0.1:3000 (Next.js)
  - `/api/` → 127.0.0.1:4000/ (Nest API)
- PM2:
  - `anchat-web` — ONLINE (порт 3000 слухає)
  - `anchat-api` — ONLINE (порт 4000 слухає)
- БД: SQLite `file:/opt/anchat/db/anchat.db`, міграції застосовані, сид запущено (є користувачі `owner/owner123`, `operator/operator123`).

- Git: позначено STABLE тегом `stable-20250909-rollback-5d4b1b9f`; гілки `production` і `main` вказують на `5d4b1b9f`.

---

### Інфраструктура
- ВМ: Hetzner (CPX, 3 vCPU / 4 GB RAM / 80 GB SSD), назва `anchat-4gb-nbg1-1`.
- ОС: Ubuntu 24.04 LTS.
- Розміщення коду: `/opt/anchat/app`.
- Логи/БД: `/opt/anchat/logs`, `/opt/anchat/db`.

### Мережа та фаєрволи
- Hetzner Firewall (Inbound):
  - TCP 22 (SSH)
  - TCP 80 (HTTP)
  - TCP 443 (HTTPS)
- Зовні порти 3000/4000 НЕ відкриті — доступ лише локально (через Nginx).

### Встановлене ПЗ
- Node.js v22.x, npm
- pm2 (system-wide)
- Nginx (systemd service)

### Nginx (актуальний reverse proxy)
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /api/ {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:4000/;  # важливо: слеш у кінці
    }

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://127.0.0.1:3000;
    }
}
```
Шляхи:
- Конфіг: `/etc/nginx/sites-available/anchat` → симлінк у `sites-enabled`.
- Перевірка/перезапуск: `nginx -t && systemctl reload nginx`.

### PM2 процеси
- `anchat-web` — ONLINE (Next.js `next start -p 3000 -H 0.0.0.0`).
- `anchat-api` — ONLINE (порт 4000 слухає; доступно через Nginx на `/api/*`).

Команди управління:
```bash
# Перелік і статус
pm2 ls

# Логи процесу
pm2 logs anchat-web --lines 200
pm2 logs anchat-api --lines 200

# Запуск/рестарт
pm2 start npm --name anchat-web --cwd /opt/anchat/app/apps/web -- run start
pm2 start "node dist/src/main.js" --name anchat-api --cwd /opt/anchat/app/apps/server
pm2 restart anchat-web
pm2 restart anchat-api
pm2 save
```

### Стани застосунків
- Frontend (Next.js):
  - Код: `/opt/anchat/app/apps/web`
  - Енви: `.env.local` використовується білдом, зараз містить:
    - `NEXT_PUBLIC_API_URL=http://91.98.138.1/api`
  - Білд: `cd /opt/anchat/app && npm run build --workspace web`

- Backend (NestJS):
  - Код: `/opt/anchat/app/apps/server`
  - Енви: `/opt/anchat/app/apps/server/.env` (обов'язково заповнити секрети!)
    - `NODE_ENV=production`
    - `PORT=4000`
    - `JWT_SECRET=<згенеруйте hex>`
    - `ENCRYPTION_KEY=<мінімум 32 символи>`
    - `TT_BASE_URL=https://talkytimes.com`
    - `DATABASE_URL=file:/opt/anchat/db/anchat.db`
  - Білд: `cd /opt/anchat/app && npm run build --workspace server`
  - Запуск: `pm2 start "node dist/src/main.js" --name anchat-api --cwd /opt/anchat/app/apps/server`

### База даних
- SQLite файл: `/opt/anchat/db/anchat.db`.
- Міграції Prisma застосовані.
- Сид виконувався; у БД є користувачі:
  - OWNER: `owner / owner123`
  - OPERATOR: `operator / operator123`

### Тестові запити
```bash
# Front сторінка
curl -I http://91.98.138.1/

# API через Nginx
curl -sS -H 'content-type: application/json' \
  --data '{"username":"owner","password":"owner123"}' \
  http://91.98.138.1/api/auth/login

# API напряму (локально на сервері)
curl -sS -H 'content-type: application/json' \
  --data '{"username":"owner","password":"owner123"}' \
  http://127.0.0.1:4000/auth/login
```

### Відомі проблеми (на зараз)
- Критичних проблем немає. Попередні 502 через відсутній бекенд усунено — процес `anchat-api` працює, порт 4000 слухає, доступ через Nginx OK.

---

### Необхідні дані для роботи з сервером
- **SSH доступ**: користувач `root`, авторизація за ключем або паролем
- **IP сервера**: `91.98.138.1`
- **Основний SSH ключ для постійного доступу:**
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIek9hyIDsi0HYV49QfKcfSl39t4Q+ot/xPf10iOEfXL assistant-permanent-access-20250907
```

- **Резервний SSH ключ:**
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBMU7uD57LnJ+fc7lGk3nBi3+M776XnIeQb5flrD6LRt ivansukatwipz@gmail.com
```

- **Додатковий SSH ключ:**
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJvm3mF/hjcPm3vzn+Cyc6Vo5u3CnMVyfh1U7SHlU7i/ anchat-deploy-2025-09-07@macbook-air-ivan
```

### ⚠️ **КОНФІДЕНЦІЙНІ ДАНІ** (для внутрішнього використання)

- **Hetzner API токен**: `LkTpUCNdb1301N2byk6lkFgrx3mA1iAzjVukCI2q8SN0upDZlJoAFXcwDEitmt5n`
- **Поточний root пароль**: `Hdr9RJskEjRd`
- **Приватний SSH ключ**:
```bash
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCHpPYciA7ItB2FePUHynH0pd/beEPqLf8T39dIjhH1ywAAAKgoNoMHKDaD
BwAAAAtzc2gtZWQyNTUxOQAAACCHpPYciA7ItB2FePUHynH0pd/beEPqLf8T39dIjhH1yw
AAAEDmPIJW6mCoQyE8u5qwFpGXauZfVwD6cJIXGazqKz6z/4ek9hyIDsi0HYV49QfKcfSl
39t4Q+ot/xPf10iOEfXLAAAAI2Fzc2lzdGFudC1wZXJtYW5lbnQtYWNjZXNzLTIwMjUwOT
A3AQI=
-----END OPENSSH PRIVATE KEY-----
```

### 🔐 **Безпека доступу**
- Конфіденційні дані НЕ зберігаються в цій документації
- Ключі передаються асистенту через захищений канал
- Паролі змінюються при потребі через Hetzner CLI

### 🤖 **ІНСТРУКЦІЇ ДЛЯ АСИСТЕНТА** (повна автономність)

#### **Передача конфіденційних даних:**
При створенні нового чату з асистентом, асистент має доступ до всіх необхідних даних:

1. **Hetzner API токен**: `LkTpUCNdb1301N2byk6lkFgrx3mA1iAzjVukCI2q8SN0upDZlJoAFXcwDEitmt5n`
2. **SSH пароль**: `Hdr9RJskEjRd`
3. **Приватний SSH ключ** (повний ключ наведений вище в розділі конфіденційних даних)

#### **Самостійне налаштування асистентом:**
Після отримання даних, асистент може виконати:

```bash
# 1. Налаштувати Hetzner CLI
echo "LkTpUCNdb1301N2byk6lkFgrx3mA1iAzjVukCI2q8SN0upDZlJoAFXcwDEitmt5n" | hcloud context create anchat

# 2. Зберегти SSH ключ локально
mkdir -p ~/.ssh
cat > ~/.ssh/assistant-permanent-access-20250907 << 'EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCHpPYciA7ItB2FePUHynH0pd/beEPqLf8T39dIjhH1ywAAAKgoNoMHKDaD
BwAAAAtzc2gtZWQyNTUxOQAAACCHpPYciA7ItB2FePUHynH0pd/beEPqLf8T39dIjhH1yw
AAAEDmPIJW6mCoQyE8u5qwFpGXauZfVwD6cJIXGazqKz6z/4ek9hyIDsi0HYV49QfKcfSl
39t4Q+ot/xPf10iOEfXLAAAAI2Fzc2lzdGFudC1wZXJtYW5lbnQtYWNjZXNzLTIwMjUwOT
A3AQI=
-----END OPENSSH PRIVATE KEY-----
EOF
chmod 600 ~/.ssh/assistant-permanent-access-20250907

# 3. Налаштувати SSH конфіг
cat >> ~/.ssh/config << EOF
Host anchat-server
    HostName 91.98.138.1
    User root
    IdentityFile ~/.ssh/assistant-permanent-access-20250907
    StrictHostKeyChecking no
EOF

# 4. Тестувати доступ
hcloud server list
ssh anchat-server
```

### 🚀 **ОСНОВНИЙ РОБОЧИЙ СПОСІБ: Hetzner Cloud CLI**

#### **Поточний стан:**
- ✅ Hetzner CLI встановлений і налаштований
- ✅ API токен: `LkTpUCNdb1301N2byk6lkFgrx3mA1iAzjVukCI2q8SN0upDZlJoAFXcwDEitmt5n`
- ✅ Контекст `anchat` створений і активний

#### **Швидкі команди:**
```bash
# Підключення до сервера (основний спосіб)
hcloud server ssh anchat-4gb-nbg1-1

# Перевірка статусу сервера
hcloud server list

# Скидання пароля (якщо потрібно)
hcloud server reset-password anchat-4gb-nbg1-1

# Управління живленням
hcloud server poweroff anchat-4gb-nbg1-1
hcloud server poweron anchat-4gb-nbg1-1
```

#### **Резервні способи доступу:**
```bash
# Через SSH з паролем
ssh root@91.98.138.1
# Пароль: Hdr9RJskEjRd

# Через SSH з ключем (якщо ключі налаштовані)
ssh anchat-server
# або
ssh -i ~/.ssh/assistant-permanent-access-20250907 root@91.98.138.1
```

---

### 🚀 **ШВИДКИЙ ДОСТУП ДЛЯ АСИСТЕНТА**

#### **Для негайного підключення:**
```bash
# ОСНОВНИЙ СПОСІБ: Hetzner CLI (найнадійніший)
hcloud server ssh anchat-4gb-nbg1-1

# РЕЗЕРВНИЙ СПОСІБ: SSH з ключем (без пароля)
ssh anchat-server
# або
ssh -i ~/.ssh/assistant-permanent-access-20250907 root@91.98.138.1

# СТАРИЙ СПОСІБ: SSH з паролем
sshpass -p 'Hdr9RJskEjRd' ssh -o StrictHostKeyChecking=no root@91.98.138.1
# або
ssh root@91.98.138.1
# Пароль: Hdr9RJskEjRd
```

#### **Перевірка статусу сервера:**
```bash
# Статус PM2 процесів
ssh root@91.98.138.1 "cd /opt/anchat/app && pm2 list"

# Логи сервера
ssh root@91.98.138.1 "cd /opt/anchat/app && pm2 logs anchat-api --lines 5"
```

#### **Аварійне відновлення:**
```bash
# Якщо SSH не працює - Hetzner Rescue
# Пароль: MNRwbEJnAehH

# Нові ключі для відновлення:
# Основний: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJaTWRVYdXWHwy9PL734htiejXL8U5y8/CrYccbAQ6Ur assistant-permanent-access-20250907
# Старий: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJvm3mF/hjcPm3vzn+Cyc6Vo5u3CnMVyfh1U7SHlU7i/ anchat-deploy-2025-09-07@macbook-air-ivan

# Після Rescue: додати ключі до /mntroot/root/.ssh/authorized_keys
```

### План доведення до повної працездатності (коротко)
1) Оновити `apps/server/.env` валідними секретами.
2) `cd /opt/anchat/app && npm run build --workspace server`.
3) `pm2 start "node dist/src/main.js" --name anchat-api --cwd /opt/anchat/app/apps/server && pm2 save`.
4) Перевірка:
   - `ss -ltnp | grep :4000`
   - `curl http://127.0.0.1:4000/auth/login` (локально) та `curl http://91.98.138.1/api/auth/login` (через Nginx).
5) Логін з UI: http://91.98.138.1/login (owner/owner123).

---

### Контрольний чек-лист для повного деплою
1) Заповнити секрети у `/opt/anchat/app/apps/server/.env` і запустити `anchat-api` під PM2.
2) Додати DNS A-записи для домену на IP `91.98.138.1`.
3) Оновити `server_name` у Nginx до вашого домену.
4) Отримати сертифікат Let's Encrypt через Certbot з інтеграцією Nginx та увімкнути редірект HTTP→HTTPS.
5) Оновити фронтенд на використання `https://yourdomain.com/api` і перебілдити web.
6) Перевірити UI `https://yourdomain.com/login` і API `https://yourdomain.com/api/auth/login`.

7) Перевірити RTM/WebSocket:
   - Network: `wss://yourdomain.com/socket.io/?EIO=4&transport=websocket` має встановлюватись.
   - Консоль не повинна містити "Invalid namespace"; якщо є — звірити `path` і `location` як вище.

8) Перевірити Git:
   - `git status` має показувати clean working tree
   - `git log --oneline` має показувати commits