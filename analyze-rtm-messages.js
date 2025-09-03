const fs = require('fs');

console.log('📊 Аналіз RTM повідомлень TalkyTimes\n');

try {
    const logContent = fs.readFileSync('/Users/ivanpenzakov/Documents/AnChat/V1/apps/server/server.log', 'utf8');
    
    // Знаходимо всі RTM повідомлення
    const rtmMessages = [];
    const lines = logContent.split('\n');
    
    let currentMessage = null;
    let collectingMessage = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Початок нового RTM повідомлення
        if (line.includes('📨 RTM: Received message')) {
            if (currentMessage) {
                rtmMessages.push(currentMessage);
            }
            currentMessage = {
                timestamp: line.match(/\d{2}:\d{2}:\d{2}/)?.[0] || 'unknown',
                raw: '',
                parsed: null
            };
            collectingMessage = true;
            continue;
        }
        
        // Збираємо JSON частину повідомлення
        if (collectingMessage && (line.includes('{') || line.includes('}') || line.includes('"'))) {
            currentMessage.raw += line.trim() + '\n';
            
            // Спробуємо парсити JSON
            try {
                const cleaned = currentMessage.raw.replace(/^\[Nest\].*?LOG.*?$\n?/gm, '').trim();
                if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                    currentMessage.parsed = JSON.parse(cleaned);
                }
            } catch (e) {
                // JSON ще не повний
            }
        }
        
        // Кінець повідомлення
        if (collectingMessage && (line.includes('LOG [TalkyTimesRTMService]') && !line.includes('📨 RTM: Received message'))) {
            collectingMessage = false;
        }
    }
    
    // Додаємо останнє повідомлення
    if (currentMessage) {
        rtmMessages.push(currentMessage);
    }
    
    console.log(`🔍 Знайдено ${rtmMessages.length} RTM повідомлень\n`);
    
    // Аналізуємо типи повідомлень
    const messageTypes = new Map();
    const pushMessages = [];
    
    rtmMessages.forEach((msg, index) => {
        if (!msg.parsed) return;
        
        // Тип повідомлення на верхньому рівні
        const topLevelKeys = Object.keys(msg.parsed);
        topLevelKeys.forEach(key => {
            messageTypes.set(key, (messageTypes.get(key) || 0) + 1);
        });
        
        // Push повідомлення (реальні дані)
        if (msg.parsed.push) {
            pushMessages.push({
                index,
                timestamp: msg.timestamp,
                channel: msg.parsed.push.channel,
                type: msg.parsed.push.pub?.data?.type,
                messageType: msg.parsed.push.pub?.data?.data?.message?.type,
                data: msg.parsed.push.pub?.data
            });
        }
    });
    
    console.log('📋 Типи RTM повідомлень:');
    [...messageTypes.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`  ${type}: ${count} разів`);
        });
    
    console.log('\n📨 Push повідомлення (реальні дані):');
    pushMessages.forEach(push => {
        console.log(`\n⏰ ${push.timestamp}`);
        console.log(`📡 Канал: ${push.channel}`);
        console.log(`🏷️  Тип події: ${push.type}`);
        console.log(`💬 Тип повідомлення: ${push.messageType}`);
        
        if (push.data?.data?.message) {
            const msg = push.data.data.message;
            console.log(`👤 Від: ${msg.idUserFrom} → До: ${msg.idUserTo}`);
            console.log(`🆔 ID: ${msg.id}`);
            console.log(`📅 Дата: ${msg.dateCreated}`);
            
            if (msg.content) {
                console.log(`📝 Контент:`, JSON.stringify(msg.content, null, 2));
            }
        }
        console.log('─'.repeat(50));
    });
    
    // Унікальні типи повідомлень в push
    const uniqueMessageTypes = [...new Set(pushMessages.map(p => p.messageType).filter(Boolean))];
    console.log('\n🎯 Унікальні типи повідомлень в push:');
    uniqueMessageTypes.forEach(type => {
        console.log(`  - ${type}`);
    });
    
    // Унікальні типи подій
    const uniqueEventTypes = [...new Set(pushMessages.map(p => p.type).filter(Boolean))];
    console.log('\n🎯 Унікальні типи подій:');
    uniqueEventTypes.forEach(type => {
        console.log(`  - ${type}`);
    });
    
} catch (error) {
    console.error('❌ Помилка:', error.message);
}
