const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const prisma = new PrismaClient();

async function testRealAPI() {
  try {
    console.log('🎯 ТЕСТ З РЕАЛЬНИМ TT API');
    console.log('========================');
    
    // Створюємо JWT токен для OWNER
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      include: { agency: true }
    });
    
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
    
    console.log('🔐 JWT токен створено');
    
    // Тест діалогів
    console.log('\n💬 ТЕСТ ДІАЛОГІВ:');
    console.log('=================');
    
    const dialogsResponse = await fetch('http://localhost:4000/api/chats/dialogs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📥 Status: ${dialogsResponse.status}`);
    
    if (!dialogsResponse.ok) {
      const errorText = await dialogsResponse.text();
      console.log(`❌ Помилка діалогів: ${errorText}`);
      return;
    }
    
    const dialogsData = await dialogsResponse.json();
    console.log(`✅ Діалогів отримано: ${dialogsData.dialogs?.length || 0}`);
    
    if (!dialogsData.dialogs || dialogsData.dialogs.length === 0) {
      console.log('⚠️  Немає діалогів');
      return;
    }
    
    // Тест повідомлень
    console.log('\n📨 ТЕСТ ПОВІДОМЛЕНЬ:');
    console.log('====================');
    
    const dialog = dialogsData.dialogs[0];
    const dialogId = `${dialog.idUser}-${dialog.idInterlocutor}`;
    
    console.log(`📋 Тестуємо діалог: ${dialogId}`);
    
    const messagesUrl = `http://localhost:4000/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages`;
    
    const messagesResponse = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📥 Status: ${messagesResponse.status}`);
    
    if (messagesResponse.ok) {
      const messagesData = await messagesResponse.json();
      console.log(`🎉 РЕАЛЬНИЙ API ПРАЦЮЄ! Повідомлень: ${messagesData.messages?.length || 0}`);
      
      if (messagesData.messages?.length > 0) {
        console.log(`📄 Перше повідомлення: ${messagesData.messages[0].content?.message?.substring(0, 50)}...`);
      }
    } else {
      const errorText = await messagesResponse.text();
      console.log(`💥 РЕАЛЬНИЙ API НЕ ПРАЦЮЄ: ${errorText}`);
    }
    
  } catch (error) {
    console.error('💥 Помилка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealAPI();
