const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const prisma = new PrismaClient();

async function debugReal() {
  try {
    console.log('🔍 ДЕБАГ РЕАЛЬНОГО API');
    console.log('======================');
    
    // Отримуємо правильного користувача
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      include: { agency: true }
    });
    
    console.log(`👤 Користувач: ${owner.username} (ID: ${owner.id})`);
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: owner.id,
        username: owner.username,
        role: owner.role,
        agencyCode: owner.agency.code
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-in-production',
      { expiresIn: '1h' }
    );
    
    console.log('🔐 Токен створено');
    
    // Спочатку отримуємо діалоги
    console.log('\n📞 Запит діалогів...');
    const dialogsResponse = await fetch('http://localhost:4000/api/chats/dialogs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!dialogsResponse.ok) {
      console.log(`❌ Діалоги: ${dialogsResponse.status}`);
      return;
    }
    
    const dialogsData = await dialogsResponse.json();
    console.log(`✅ Діалогів: ${dialogsData.dialogs?.length}`);
    
    if (dialogsData.dialogs?.length > 0) {
      const dialog = dialogsData.dialogs[0];
      console.log(`📋 Перший діалог: ${dialog.idUser}-${dialog.idInterlocutor}`);
      
      // Тепер спробуємо отримати повідомлення
      console.log('\n📨 Запит повідомлень...');
      
      const dialogId = `${dialog.idUser}-${dialog.idInterlocutor}`;
      const messagesUrl = `http://localhost:4000/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages`;
      
      console.log(`🔗 URL: ${messagesUrl}`);
      
      const messagesResponse = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📥 Статус повідомлень: ${messagesResponse.status}`);
      
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        console.log(`🎉 ПРАЦЮЄ! Повідомлень: ${messagesData.messages?.length}`);
      } else {
        const errorText = await messagesResponse.text();
        console.log(`❌ Помилка: ${errorText}`);
        
        // Спробуємо ще раз через 2 секунди
        console.log('\n⏳ Чекаємо 2 секунди і пробуємо знову...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryResponse = await fetch(messagesUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`📥 Повторний статус: ${retryResponse.status}`);
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          console.log(`🎉 ПРАЦЮЄ ПІСЛЯ ПОВТОРУ! Повідомлень: ${retryData.messages?.length}`);
        } else {
          const retryError = await retryResponse.text();
          console.log(`❌ Повторна помилка: ${retryError}`);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Помилка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugReal();
