const WebSocket = require('ws');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔌 Starting direct RTM monitor using cookies from local DB...');

function loadSessionsFromDb() {
  try {
    const dbPath = '/Users/ivanpenzakov/Documents/AnChat/V1/apps/server/prisma/prisma/dev.db';
    // Використовуємо таб як розділювач, щоб безпечно парсити cookies
    const cmd = `sqlite3 ${dbPath} ".mode tabs" "select profileId, cookies from TalkyTimesSession;"`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    if (!out) return [];
    const rows = out.split('\n').map(line => {
      const [profileId, ...rest] = line.split('\t');
      const cookies = rest.join('\t');
      return { profileId: parseInt(profileId, 10), cookies: cookies };
    }).filter(r => r.profileId && r.cookies);
    const filterId = process.env.TT_PROFILE_ID ? parseInt(process.env.TT_PROFILE_ID, 10) : null;
    return filterId ? rows.filter(r => r.profileId === filterId) : rows;
  } catch (e) {
    console.error('❌ Failed to load sessions from DB:', e.message);
    return [];
  }
}

function connectProfile(session) {
  const headers = {
    'Origin': 'https://talkytimes.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Cookie': session.cookies
  };

  console.log(`🔌 [${session.profileId}] Connecting to wss://talkytimes.com/rtm...`);
  let ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

  let heartbeat; // RFC ping
  let appPing;   // app-level ping/pong
  let reconnectTimer;
  let lastMessageAt = Date.now();
  const APP_PING_INTERVAL_MS = 20000;
  const APP_PONG_TIMEOUT_MS = 15000;
  const RECONNECT_DELAY_MS = 5000;

  ws.on('open', () => {
    console.log(`✅ [${session.profileId}] RTM connected`);
    const connectMessage = { connect: { name: 'js' }, id: 1 };
    ws.send(JSON.stringify(connectMessage));
    heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    // App-level ping/pong слідкування
    let waitingPong = false;
    appPing = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      const sinceLast = now - lastMessageAt;
      if (waitingPong && sinceLast > APP_PONG_TIMEOUT_MS) {
        console.warn(`⚠️ [${session.profileId}] No app-pong for ${sinceLast}ms, reconnecting...`);
        try { ws.terminate(); } catch (_) {}
        return;
      }
      waitingPong = true;
      const pingMsg = { ping: now };
      ws.send(JSON.stringify(pingMsg));
    }, APP_PING_INTERVAL_MS);
  });

  ws.on('message', (data) => {
    let obj = null;
    try {
      obj = JSON.parse(data.toString());
    } catch (_) {}

    const ts = new Date().toISOString();
    lastMessageAt = Date.now();
    if (obj) {
      console.log(`📨 [${session.profileId}] ${ts}:`, JSON.stringify(obj));
      try { fs.appendFileSync('/Users/ivanpenzakov/Documents/AnChat/V1/rtm-direct-live.log', `[#${session.profileId}] ${ts} ${JSON.stringify(obj)}\n`); } catch (_) {}

      // App-level pong
      if (Object.prototype.hasOwnProperty.call(obj, 'pong')) {
        // деякі RTM реалізації повертають pong; фіксуємо й не робимо нічого
      }

      // Вловлюємо будь-які push-и та ключові типи
      const topType = obj?.push?.pub?.data?.type || obj?.type;
      if (topType && /(mail|Mail|Correspondence|Letter)/.test(String(topType))) {
        console.log(`📧 [${session.profileId}] Mail-related RTM type detected: ${topType}`);
      }

      // Не надсилаємо ручних підписок: TT сам додає персональний канал через cookies
    } else {
      console.log(`📨 [${session.profileId}] ${ts}: RAW ${data.toString()}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`❌ [${session.profileId}] RTM error:`, err.message);
  });

  ws.on('close', (code, reason) => {
    if (heartbeat) clearInterval(heartbeat);
    if (appPing) clearInterval(appPing);
    console.log(`🔌 [${session.profileId}] RTM closed (${code}): ${reason}`);
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        console.log(`🔄 [${session.profileId}] Reconnecting after close...`);
        connectProfile(session);
      }, RECONNECT_DELAY_MS);
    }
  });
}

const sessions = loadSessionsFromDb();
if (!sessions.length) {
  console.error('❌ No sessions found in DB. Exiting.');
  process.exit(1);
}

console.log(`🔎 Found ${sessions.length} session(s): ${sessions.map(s => s.profileId).join(', ')}`);
sessions.forEach(connectProfile);

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down direct RTM monitor...');
  process.exit(0);
});
