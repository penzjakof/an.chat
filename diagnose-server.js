#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 ДІАГНОСТИКА СЕРВЕРА WEB SOCKET\n');
console.log('=' .repeat(50));

// 1. Перевірка середовища
console.log('📋 ПЕРЕВІРКА СЕРЕДОВИЩА:');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js версія: ${nodeVersion}`);

  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ NPM версія: ${npmVersion}`);

  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`📊 NODE_ENV: ${nodeEnv}`);
} catch (error) {
  console.log(`❌ Помилка перевірки середовища: ${error.message}`);
}

// 2. Перевірка портів
console.log('\n🔌 ПЕРЕВІРКА ПОРТІВ:');
try {
  const port4000 = execSync('lsof -i :4000 2>/dev/null || echo "Порт вільний"', { encoding: 'utf8' }).trim();
  console.log(`Порт 4000: ${port4000 || 'вільний'}`);

  const port3000 = execSync('lsof -i :3000 2>/dev/null || echo "Порт вільний"', { encoding: 'utf8' }).trim();
  console.log(`Порт 3000: ${port3000 || 'вільний'}`);
} catch (error) {
  console.log(`❌ Помилка перевірки портів: ${error.message}`);
}

// 3. Перевірка процесів
console.log('\n⚙️ ПЕРЕВІРКА ПРОЦЕСІВ:');
try {
  const nodeProcesses = execSync('ps aux | grep node | grep -v grep | head -5', { encoding: 'utf8' });
  if (nodeProcesses.trim()) {
    console.log('Node.js процеси:');
    console.log(nodeProcesses);
  } else {
    console.log('❌ Немає запущених Node.js процесів');
  }
} catch (error) {
  console.log(`❌ Помилка перевірки процесів: ${error.message}`);
}

// 4. Перевірка файлів конфігурації
console.log('\n📁 ПЕРЕВІРКА КОНФІГУРАЦІЙ:');
const configFiles = [
  'apps/server/src/main.ts',
  'apps/server/src/chats/chats.gateway.ts',
  'apps/server/src/app.module.ts',
  'apps/server/package.json'
];

configFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${filePath} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${filePath} - не знайдено`);
  }
});

// 5. Перевірка залежностей
console.log('\n📦 ПЕРЕВІРКА ЗАЛЕЖНОСТЕЙ:');
const serverPackagePath = path.join(process.cwd(), 'apps/server/package.json');
if (fs.existsSync(serverPackagePath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(serverPackagePath, 'utf8'));
    const keyDeps = ['@nestjs/websockets', 'socket.io', 'socket.io-client'];

    console.log('Ключові залежності:');
    keyDeps.forEach(dep => {
      const version = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
      if (version) {
        console.log(`✅ ${dep}: ${version}`);
      } else {
        console.log(`❌ ${dep}: відсутня`);
      }
    });
  } catch (error) {
    console.log(`❌ Помилка читання package.json: ${error.message}`);
  }
}

// 6. Перевірка змінних середовища
console.log('\n🔧 ПЕРЕВІРКА ЗМІННИХ СЕРЕДОВИЩА:');
const envVars = ['NODE_ENV', 'PORT', 'JWT_SECRET', 'TT_BASE_URL'];
envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: встановлено`);
  } else {
    console.log(`⚠️ ${varName}: не встановлено`);
  }
});

// 7. Перевірка мережі
console.log('\n🌐 ПЕРЕВІРКА МЕРЕЖІ:');
try {
  execSync('curl -s --connect-timeout 5 http://localhost:4000/health || echo "Сервер не відповідає"', { stdio: 'inherit' });
} catch (error) {
  console.log('Сервер на localhost:4000 не відповідає');
}

// 8. Рекомендації
console.log('\n💡 РЕКОМЕНДАЦІЇ:');
console.log('1. Переконайтеся що сервер запущений: npm run start:prod');
console.log('2. Перевірте логи сервера на наявність помилок');
console.log('3. Для продакшену налаштуйте reverse proxy (nginx)');
console.log('4. Перевірте CORS налаштування для вашого домену');
console.log('5. Впевніться що SSL сертифікати налаштовані правильно');

console.log('\n' + '=' .repeat(50));
console.log('✅ Діагностика завершена');
