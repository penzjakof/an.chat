const WebSocket = require('ws');

console.log('🔌 Testing RTM WebSocket connection with session cookies...');

// Спробуємо використати cookies з профілю
const sessionCookies = 'cc_cookie=%7B%22required%22%3A1%2C%22marketing%22%3A0%7D; sm_anonymous_id=8c13911a-9578-4fc8-905a-5abbe3edbacf; _hjSessionUser_2813883=eyJpZCI6IjZlYWQ2MDE4LTFkNmItNWMxOC04MGEyLThiNWZiMmJiYWMzYyIsImNyZWF0ZWQiOjE3NTM4OTI2NzkzNDAsImV4aXN0aW5nIjp0cnVlfQ==; _hjSession_2813883=eyJpZCI6IjcyZjRhMThmLTBmNjMtNGMzYi1iZWY1LTBlNDc1MDBlY2E2NSIsImMiOjE3NTY1NTEzODE3ODQsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; tld-token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoidXNlciIsImlzcyI6ImRlZiIsInZlciI6IjEuMSIsImlhdCI6MTc1NjU1NzM0NCwiZXhwIjoxNzU5MjM1NzQ0LCJzdWIiOjcxNjI0Mzd9.WC8R1Jxh-fsKf3ufPm7_efmzOHDxDzSsvtzi7XcfB0A; tu_auth=%7B%22result%22%3Atrue%2C%22idUser%22%3A7162437%2C%22refreshToken%22%3A%221cf0985f8c594b4c2d713a0bc66cd0be1b4bc85c%22%7D; _csrf=GED4Ups3_DncYKdpO7ss-xXW12ioIlg-';

const headers = {
    'Origin': 'https://talkytimes.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Cookie': sessionCookies
};

console.log('🔌 Connecting to wss://talkytimes.com/rtm...');

const ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

ws.on('open', () => {
    console.log('✅ RTM: Connected successfully!');
    // Надсилаємо connect повідомлення
    const connectMessage = { connect: { name: "js" }, id: 1 };
    console.log('📡 Sending connect message:', JSON.stringify(connectMessage));
    ws.send(JSON.stringify(connectMessage));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 RTM: Received message:', JSON.stringify(message, null, 2));

        // Якщо отримали connect відповідь, підписуємося на канали
        if (message.connect) {
            console.log('🔗 RTM: Connect successful, subscribing to channels...');

            // Підписка на broadcast
            const broadcastMessage = { subscribe: { channel: "broadcast" }, id: 2 };
            console.log('📡 Sending broadcast subscription:', JSON.stringify(broadcastMessage));
            ws.send(JSON.stringify(broadcastMessage));

            // Підписка на user канал
            const userMessage = { subscribe: { channel: "user_7162437" }, id: 3 };
            console.log('📡 Sending user subscription:', JSON.stringify(userMessage));
            ws.send(JSON.stringify(userMessage));
        }
    } catch (error) {
        console.log('📨 RTM: Received raw data:', data.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ RTM: Error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 RTM: Closed (${code}): ${reason}`);
});

// Таймаут для тестування
setTimeout(() => {
    console.log('⏰ Test timeout, closing...');
    ws.close();
}, 15000);
