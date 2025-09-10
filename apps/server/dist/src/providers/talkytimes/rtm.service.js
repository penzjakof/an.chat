"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TalkyTimesRTMService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalkyTimesRTMService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const ws_1 = __importDefault(require("ws"));
const session_service_1 = require("./session.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let TalkyTimesRTMService = TalkyTimesRTMService_1 = class TalkyTimesRTMService {
    eventEmitter;
    sessionService;
    logger = new common_1.Logger(TalkyTimesRTMService_1.name);
    connections = new Map();
    maxReconnectAttempts = 3;
    reconnectDelay = 3000;
    connectionTimeout = 10000;
    isConnecting = false;
    rtmLogFilePath = path.resolve(process.cwd(), 'tt-rtm-messages.log');
    appendRtmLog(entry) {
        try {
            const payload = { timestamp: new Date().toISOString(), ...entry };
            fs.appendFileSync(this.rtmLogFilePath, JSON.stringify(payload) + '\n', 'utf8');
        }
        catch (e) {
        }
    }
    constructor(eventEmitter, sessionService) {
        this.eventEmitter = eventEmitter;
        this.sessionService = sessionService;
    }
    async onModuleInit() {
        this.logger.log('🚀 RTM Service initializing...');
        await this.connect();
    }
    onModuleDestroy() {
        this.cleanup();
    }
    cleanup() {
        for (const [profileId, connection] of this.connections) {
            this.logger.log(`🔌 RTM: Closing connection for profile ${profileId}`);
            connection.ws.close();
            if (connection.heartbeatInterval) {
                clearInterval(connection.heartbeatInterval);
            }
            if (connection.reconnectTimeout) {
                clearTimeout(connection.reconnectTimeout);
            }
        }
        this.connections.clear();
        this.isConnecting = false;
    }
    async connect() {
        if (this.isConnecting) {
            this.logger.log('🔌 RTM: Already connecting');
            return;
        }
        this.isConnecting = true;
        this.logger.log('🔌 RTM: Starting connections for all profiles...');
        try {
            const sessions = await this.sessionService.getAllActiveSessions();
            if (!sessions.length) {
                this.logger.warn('⚠️ RTM: No active sessions found');
                this.isConnecting = false;
                return;
            }
            this.logger.log(`🔌 RTM: Found ${sessions.length} profiles to connect`);
            for (const session of sessions) {
                await this.connectProfile(session);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            this.isConnecting = false;
            this.logger.log(`✅ RTM: All connections established (${this.connections.size} profiles)`);
        }
        catch (error) {
            this.isConnecting = false;
            this.logger.error('❌ RTM: Connection error:', error);
        }
    }
    async connectProfile(session) {
        const profileId = session.profileId;
        const timestamp = new Date().toISOString();
        if (this.connections.has(profileId)) {
            this.logger.log(`🔌 RTM: Profile ${profileId} already connected`);
            return;
        }
        this.logger.log(`🔌 RTM: Connecting profile ${profileId} with own cookies at ${timestamp}`);
        const isValid = await this.sessionService.validateSession(profileId.toString());
        if (!isValid) {
            this.logger.warn(`⚠️ RTM: Session validation failed for profile ${profileId}`);
            return;
        }
        const headers = {
            'Origin': 'https://talkytimes.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Cookie': session.cookies
        };
        const ws = new ws_1.default('wss://talkytimes.com/rtm', { headers });
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState === ws_1.default.CONNECTING) {
                this.logger.warn(`⚠️ RTM: Connection timeout for profile ${profileId}, closing...`);
                ws.close();
            }
        }, this.connectionTimeout);
        ws.on('open', () => {
            clearTimeout(connectionTimeout);
            const timestamp = new Date().toISOString();
            this.logger.log(`✅ RTM: Profile ${profileId} connected successfully at ${timestamp}!`);
            const connectMessage = { connect: { name: "js", version: "1.0" }, id: 1 };
            ws.send(JSON.stringify(connectMessage));
            this.logger.log(`📤 RTM: Sent connect message for profile ${profileId} at ${timestamp}`);
            const heartbeatInterval = setInterval(() => {
                if (ws.readyState === ws_1.default.OPEN) {
                    ws.ping();
                    const timestamp = new Date().toISOString();
                    this.logger.log(`💓 RTM: Sent heartbeat for profile ${profileId} at ${timestamp}`);
                }
            }, 30000);
            this.connections.set(profileId, {
                ws,
                heartbeatInterval,
                reconnectAttempts: 0,
                session
            });
        });
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                const timestamp = new Date().toISOString();
                this.logger.log(`📨 RTM: Profile ${profileId} received message at ${timestamp}:`, JSON.stringify(message, null, 2));
                this.appendRtmLog({ profileId, direction: 'in', message });
                this.handleMessage(message, profileId);
            }
            catch (error) {
                const timestamp = new Date().toISOString();
                this.logger.error(`❌ RTM: Profile ${profileId} failed to parse message at ${timestamp}:`, error);
            }
        });
        ws.on('close', (code, reason) => {
            clearTimeout(connectionTimeout);
            const timestamp = new Date().toISOString();
            this.logger.warn(`🔌 RTM: Profile ${profileId} connection closed at ${timestamp} (${code}): ${reason}`);
            this.appendRtmLog({ profileId, event: 'close', code, reason: reason?.toString?.() });
            const connection = this.connections.get(profileId);
            if (connection) {
                clearInterval(connection.heartbeatInterval);
                this.connections.delete(profileId);
                if (connection.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnectProfile(profileId, session, connection.reconnectAttempts + 1);
                }
            }
        });
        ws.on('error', (error) => {
            clearTimeout(connectionTimeout);
            const timestamp = new Date().toISOString();
            this.logger.error(`❌ RTM: Profile ${profileId} WebSocket error at ${timestamp}:`, error);
            this.appendRtmLog({ profileId, event: 'error', error: error?.message || String(error) });
            const connection = this.connections.get(profileId);
            if (connection) {
                clearInterval(connection.heartbeatInterval);
                this.connections.delete(profileId);
            }
        });
    }
    scheduleReconnectProfile(profileId, session, attempt) {
        const timestamp = new Date().toISOString();
        this.logger.log(`🔄 RTM: Reconnecting profile ${profileId} in ${this.reconnectDelay}ms (attempt ${attempt}) at ${timestamp}`);
        const reconnectTimeout = setTimeout(async () => {
            try {
                await this.connectProfile({ ...session, reconnectAttempts: attempt });
            }
            catch (error) {
                this.logger.error(`❌ RTM: Profile ${profileId} reconnection failed:`, error);
            }
        }, this.reconnectDelay);
        const connection = this.connections.get(profileId);
        if (connection) {
            connection.reconnectTimeout = reconnectTimeout;
        }
    }
    handleMessage(message, profileId) {
        if (message.push?.channel?.includes('personal:')) {
            const timestamp = new Date().toISOString();
            const data = message.push.pub.data;
            this.logger.log(`🎯 RTM: Profile ${profileId} received personal message at ${timestamp}:`, data);
            const messageType = data.type;
            if (messageType === 'chat_MessageRead') {
                this.eventEmitter.emit('rtm.message.read', {
                    profileId,
                    idInterlocutor: data.data?.idInterlocutor,
                    idMessage: data.data?.idMessage,
                    timestamp
                });
                this.logger.log(`📖 RTM: Message read event emitted for profile ${profileId}`);
            }
            else if (messageType === 'chat_DialogTyping') {
                this.logger.log(`⌨️ RTM: Typing event for profile ${profileId} (not emitted)`);
            }
            else if (messageType === 'chat_MessageNew' || messageType === 'chat_MessageSent' || messageType === 'MessageSent' || messageType === 'MessageNew') {
                const messageData = data.data?.message || data.message || data;
                this.eventEmitter.emit('rtm.message.new', {
                    profileId,
                    idUserFrom: messageData?.idUserFrom,
                    idUserTo: messageData?.idUserTo,
                    content: messageData?.content,
                    type: messageData?.type,
                    message: messageData,
                    messageId: messageData?.id || data.id,
                    dateCreated: messageData?.dateCreated || timestamp,
                    timestamp
                });
                this.logger.log(`🆕 RTM: New message event emitted for profile ${profileId}, from: ${messageData?.idUserFrom}, to: ${messageData?.idUserTo}`);
            }
            else if (messageType === 'email') {
                const emailData = data?.email || data?.data?.email || data?.data;
                if (emailData) {
                    this.eventEmitter.emit('rtm.email.new', {
                        profileId,
                        idUserFrom: emailData.id_user_from,
                        idUserTo: emailData.id_user_to,
                        emailId: emailData.id,
                        correspondenceId: emailData.id_correspondence,
                        title: emailData.title,
                        contentHtml: emailData.content,
                        dateCreated: emailData.dateCreated || timestamp,
                        timestamp
                    });
                    this.logger.log(`✉️ RTM: New email event emitted for profile ${profileId}, from: ${emailData.id_user_from}, to: ${emailData.id_user_to}`);
                }
                else {
                    this.logger.warn(`✉️ RTM: Email event received but email data missing for profile ${profileId}`);
                }
            }
            else if (messageType === 'chat_DialogLimitChanged' || messageType === 'platform_CorrespondenceLimitChanged') {
                const limitData = data.data || data;
                this.eventEmitter.emit('rtm.dialog.limit.changed', {
                    profileId,
                    idUser: limitData?.idUser,
                    idInterlocutor: limitData?.idInterlocutor,
                    limitLeft: limitData?.limitLeft,
                    timestamp
                });
                this.logger.log(`📊 RTM: Dialog limit event emitted for profile ${profileId}: user ${limitData?.idUser}, interlocutor ${limitData?.idInterlocutor}, left ${limitData?.limitLeft}`);
            }
            else {
                this.eventEmitter.emit('rtm.message', {
                    profileId,
                    channel: message.push.channel,
                    data: data,
                    timestamp
                });
                this.logger.log(`📨 RTM: Generic message event emitted for profile ${profileId}, type: ${messageType}`);
            }
        }
        if (message.connect) {
            const timestamp = new Date().toISOString();
            this.logger.log(`🔗 RTM: Profile ${profileId} connect response at ${timestamp}:`, message.connect);
        }
        if (message.error) {
            const timestamp = new Date().toISOString();
            this.logger.error(`❌ RTM: Profile ${profileId} error at ${timestamp}:`, message.error);
        }
    }
    getConnectionStatus() {
        const status = {};
        for (const [profileId, connection] of this.connections) {
            status[profileId] = connection.ws.readyState === ws_1.default.OPEN;
        }
        return status;
    }
    async reconnectAll() {
        this.logger.log('🔄 RTM: Reconnecting all profiles...');
        this.cleanup();
        await this.connect();
    }
    disconnectProfile(profileId) {
        const id = typeof profileId === 'string' ? parseInt(profileId) : profileId;
        if (!this.connections.has(id))
            return;
        this.logger.log(`🔌 RTM: Disconnecting profile ${id}`);
        const connection = this.connections.get(id);
        try {
            connection.ws.close();
        }
        catch { }
        clearInterval(connection.heartbeatInterval);
        if (connection.reconnectTimeout)
            clearTimeout(connection.reconnectTimeout);
        this.connections.delete(id);
    }
    async subscribeToUser(userId) {
        this.logger.log(`📡 RTM: Subscribe to user ${userId} (handled automatically by profile connections)`);
    }
    async unsubscribeFromUser(userId) {
        this.logger.log(`📡 RTM: Unsubscribe from user ${userId} (handled automatically)`);
    }
};
exports.TalkyTimesRTMService = TalkyTimesRTMService;
exports.TalkyTimesRTMService = TalkyTimesRTMService = TalkyTimesRTMService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [event_emitter_1.EventEmitter2,
        session_service_1.TalkyTimesSessionService])
], TalkyTimesRTMService);
//# sourceMappingURL=rtm.service.js.map