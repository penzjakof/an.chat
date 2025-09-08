const { io } = require('socket.io-client');

// Налаштування для тестування
const SERVER_URL = 'http://localhost:4000'; // Локальний сервер для тестування
const TEST_TOKEN = 'test-jwt-token'; // Тестовий токен

console.log('🧪 Початок тестування WebSocket підключення...');
console.log(`📡 Підключення до: ${SERVER_URL}/socket.io/`);

// Створюємо Socket.IO клієнт
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  auth: {
    token: TEST_TOKEN
  },
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000
});

// Обробники подій
socket.on('connect', () => {
  console.log('✅ WebSocket підключено успішно!');
  console.log(`🔗 Socket ID: ${socket.id}`);

  // Тестуємо приєднання до кімнати діалогу
  socket.emit('join', {
    dialogId: 'test-user-1-test-user-2'
  }, (response) => {
    console.log('📨 Відповідь на join:', response);
  });
});

socket.on('disconnect', (reason) => {
  console.log(`❌ WebSocket відключено: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error('🚫 Помилка підключення WebSocket:', error.message);
  console.error('Деталі помилки:', error);
});

socket.on('message', (data) => {
  console.log('📨 Отримано повідомлення:', data);
});

socket.on('message_toast', (data) => {
  console.log('🍞 Отримано тост:', data);
});

// Таймаут для тестування
setTimeout(() => {
  console.log('⏰ Таймаут тестування - закриваємо підключення');
  socket.disconnect();
  process.exit(0);
}, 15000);
