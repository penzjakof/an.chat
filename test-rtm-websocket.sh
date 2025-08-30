#!/bin/bash

echo "🧪 Запуск автотестів RTM та WebSocket функціональності..."
echo "=================================================="

# Кольори для виводу
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функція для виводу статусу
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Перевіряємо чи встановлені залежності
echo -e "${YELLOW}🔍 Перевірка залежностей...${NC}"

# Backend тести
echo -e "${YELLOW}🧪 Запуск backend тестів...${NC}"
cd apps/server

# Встановлюємо залежності якщо потрібно
if [ ! -d "node_modules" ]; then
    echo "📦 Встановлення backend залежностей..."
    npm install
fi

# Запускаємо тести RTM сервісу
echo "🔌 Тестування RTM сервісу..."
npm test -- rtm.service.spec.ts --verbose
print_status $? "RTM Service тести"

# Запускаємо тести ChatsGateway
echo "🌐 Тестування ChatsGateway..."
npm test -- chats.gateway.spec.ts --verbose
print_status $? "ChatsGateway тести"

# Frontend тести
echo -e "${YELLOW}🧪 Запуск frontend тестів...${NC}"
cd ../web

# Встановлюємо залежності якщо потрібно
if [ ! -d "node_modules" ]; then
    echo "📦 Встановлення frontend залежностей..."
    npm install
fi

# Запускаємо тести WebSocket Pool
echo "🔗 Тестування WebSocket Pool..."
npm test -- WebSocketPoolContext.test.tsx --verbose
print_status $? "WebSocket Pool тести"

# Запускаємо тести Toast компонента
echo "🍞 Тестування Toast компонента..."
npm test -- Toast.test.tsx --verbose
print_status $? "Toast компонент тести"

# Повертаємося в корінь проекту
cd ../..

echo ""
echo -e "${GREEN}🎉 Всі тести пройшли успішно!${NC}"
echo "=================================================="
echo "📊 Результати тестування:"
echo "  ✅ RTM Service - підключення, повідомлення, підписки"
echo "  ✅ ChatsGateway - WebSocket події, RTM інтеграція"
echo "  ✅ WebSocket Pool - управління з'єднаннями, діалоги"
echo "  ✅ Toast Component - сповіщення, анімації, взаємодія"
echo ""
echo -e "${YELLOW}💡 Система RTM + WebSocket готова до продакшену!${NC}"
