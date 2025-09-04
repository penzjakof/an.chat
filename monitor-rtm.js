const WebSocket = require('ws');

console.log('🔍 Monitoring RTM messages from TalkyTimes...');
console.log('📊 Connecting to backend WebSocket...');

// Підключаємося до нашого WebSocket сервера
const ws = new WebSocket('ws://localhost:4000');

ws.on('open', () => {
    console.log('✅ Connected to backend WebSocket');
    
    // Підписуємося на тестовий діалог
    ws.send(JSON.stringify({
        type: 'join',
        dialogId: '117326723-7162437'
    }));
    
    console.log('📡 Subscribed to dialog 117326723-7162437');
    console.log('⏳ Waiting for RTM messages...\n');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        const timestamp = new Date().toISOString();
        
        console.log(`📨 [${timestamp}] Received WebSocket message:`);
        console.log(JSON.stringify(message, null, 2));
        console.log('---');
    } catch (error) {
        console.log(`📨 [${new Date().toISOString()}] Raw message:`, data.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down RTM monitor...');
    ws.close();
    process.exit(0);
});
