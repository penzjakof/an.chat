"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const event_emitter_1 = require("@nestjs/event-emitter");
const rtm_service_1 = require("../providers/talkytimes/rtm.service");
const chat_access_service_1 = require("./chat-access.service");
let ChatsGateway = ChatsGateway_1 = class ChatsGateway {
    jwt;
    rtmService;
    chatAccess;
    logger = new common_1.Logger(ChatsGateway_1.name);
    userSockets = new Map();
    processedMessageIds = new Map();
    MESSAGE_DEDUP_TTL_MS = 30_000;
    processedEmailIds = new Map();
    server;
    constructor(jwt, rtmService, chatAccess) {
        this.jwt = jwt;
        this.rtmService = rtmService;
        this.chatAccess = chatAccess;
    }
    onModuleInit() {
        this.logger.log('🔌 WebSocket Gateway initialized');
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token;
            if (!token)
                return;
            const payload = await this.jwt.verifyAsync(token);
            const authCtx = { agencyCode: payload.agencyCode, role: payload.role, userId: payload.sub, operatorCode: payload.operatorCode };
            const accessible = await this.chatAccess.getAccessibleProfiles(authCtx);
            for (const p of accessible) {
                if (p?.profileId) {
                    client.join(`profile:${p.profileId}`);
                }
            }
            this.logger.log(`👥 Socket ${client.id} joined ${accessible.length} profile rooms`);
        }
        catch (e) {
            this.logger.warn(`⚠️ handleConnection failed: ${e?.message || e}`);
        }
    }
    handleRTMMessage(data) {
        this.logger.log(`📨 RTM Message: ${data.idUserFrom} -> ${data.idUserTo}`);
        const dialogId = `${data.idUserFrom}-${data.idUserTo}`;
        const reverseDialogId = `${data.idUserTo}-${data.idUserFrom}`;
        this.server.to(`dlg:${dialogId}`).emit('message', {
            id: Date.now(),
            idUserFrom: data.idUserFrom,
            idUserTo: data.idUserTo,
            content: data.content,
            type: data.type,
            dateCreated: data.dateCreated
        });
        this.server.to(`dlg:${reverseDialogId}`).emit('message', {
            id: Date.now(),
            idUserFrom: data.idUserFrom,
            idUserTo: data.idUserTo,
            content: data.content,
            type: data.type,
            dateCreated: data.dateCreated
        });
    }
    handleRTMNewMessage(data) {
        this.logger.log(`🍞 RTM New Message Toast: ${data.idUserFrom} -> ${data.idUserTo}`);
        this.logger.log('🍞 RTM New Message data:', JSON.stringify(data, null, 2));
        const messageId = Number(data.messageId);
        const now = Date.now();
        if (!isNaN(messageId)) {
            for (const [mid, ts] of this.processedMessageIds) {
                if (now - ts > this.MESSAGE_DEDUP_TTL_MS) {
                    this.processedMessageIds.delete(mid);
                }
            }
            const lastTs = this.processedMessageIds.get(messageId);
            if (lastTs && (now - lastTs) <= this.MESSAGE_DEDUP_TTL_MS) {
                this.logger.log(`🧹 DEDUP: Skipping duplicate messageId=${messageId}`);
                return;
            }
            this.processedMessageIds.set(messageId, now);
        }
        const profileId = Number(data.profileId);
        const interlocutorId = data.idUserFrom === profileId ? data.idUserTo : data.idUserFrom;
        const dialogId = `${profileId}-${interlocutorId}`;
        const toastPayload = {
            messageId: data.messageId,
            idUserFrom: data.idUserFrom,
            idUserTo: data.idUserTo,
            dateCreated: data.dateCreated,
            type: 'new_message',
            dialogId
        };
        this.server.to(`profile:${profileId}`).emit('message_toast', toastPayload);
        const room = `dlg:${dialogId}`;
        const roomSize = this.server.sockets?.adapter?.rooms?.get(room)?.size || 0;
        if (roomSize > 0) {
            this.logger.log(`💬 Emitting message to active dialog room ${room} (clients: ${roomSize})`);
            const content = data.content || {};
            const fullMessage = data.message || {};
            const msgType = data.type || fullMessage.type || content.type || 'message';
            const plainText = content.message ?? content.text ?? '';
            this.server.to(room).emit('message', {
                id: data.messageId,
                idUserFrom: data.idUserFrom,
                idUserTo: data.idUserTo,
                type: msgType,
                content: fullMessage.content || content,
                message: plainText,
                dateCreated: data.dateCreated
            });
        }
    }
    handleRTMEmailNew(data) {
        this.logger.log(`✉️ RTM New Email: ${data.idUserFrom} -> ${data.idUserTo}`);
        const emailId = Number(data.emailId);
        const now = Date.now();
        if (!isNaN(emailId)) {
            for (const [eid, ts] of this.processedEmailIds) {
                if (now - ts > this.MESSAGE_DEDUP_TTL_MS)
                    this.processedEmailIds.delete(eid);
            }
            const last = this.processedEmailIds.get(emailId);
            if (last && now - last <= this.MESSAGE_DEDUP_TTL_MS) {
                this.logger.log(`🧹 DEDUP EMAIL: Skipping duplicate emailId=${emailId}`);
                return;
            }
            this.processedEmailIds.set(emailId, now);
        }
        const profileId = Number(data.profileId);
        const interlocutorId = data.idUserFrom === profileId ? data.idUserTo : data.idUserFrom;
        const dialogId = `${profileId}-${interlocutorId}`;
        this.server.to(`profile:${profileId}`).emit('message_toast', {
            messageId: data.emailId,
            idUserFrom: data.idUserFrom,
            idUserTo: data.idUserTo,
            dateCreated: data.dateCreated,
            type: 'new_email',
            dialogId,
            correspondenceId: data.correspondenceId,
            title: data.title
        });
    }
    handleRTMMessageRead(data) {
        this.logger.log(`👁️ RTM Message Read: ${data.messageId} by ${data.idInterlocutor}`);
        this.server.emit('message_read', {
            messageId: data.messageId,
            idInterlocutor: data.idInterlocutor
        });
    }
    handleRTMDialogLimitChanged(data) {
        this.logger.log(`📊 RTM Dialog Limit: User ${data.idUser}, limit ${data.limitLeft}`);
        const dialogId = `${data.idUser}-${data.idInterlocutor}`;
        this.server.to(`dlg:${dialogId}`).emit('dialog_limit_changed', {
            idUser: data.idUser,
            idInterlocutor: data.idInterlocutor,
            limitLeft: data.limitLeft
        });
    }
    handleShiftEnded(data) {
        this.logger.log(`🛑 Shift ended for operator ${data.operatorId}, broadcasting event`);
        this.server.emit('shift_ended', { operatorId: data.operatorId });
    }
    emitNewMessage(event) {
        this.server.to(`dlg:${event.dialogId}`).emit('message', event.payload);
    }
    async join(data, client) {
        try {
            const token = client.handshake.auth?.token;
            if (!token) {
                client.disconnect(true);
                return { error: 'No token provided' };
            }
            const payload = await this.jwt.verifyAsync(token);
            const userId = payload.sub;
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId).add(client.id);
            const profileId = parseInt(data.dialogId.split('-')[0]);
            if (!isNaN(profileId)) {
                this.rtmService.subscribeToUser(profileId.toString());
            }
            const room = `dlg:${data.dialogId}`;
            client.join(room);
            this.logger.log(`👤 User ${userId} joined dialog ${data.dialogId}`);
            return { joined: room, userId };
        }
        catch (error) {
            this.logger.error('❌ JWT verification failed', error);
            client.disconnect(true);
            return { error: 'Invalid token' };
        }
    }
};
exports.ChatsGateway = ChatsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatsGateway.prototype, "server", void 0);
__decorate([
    (0, event_emitter_1.OnEvent)('rtm.message.sent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleRTMMessage", null);
__decorate([
    (0, event_emitter_1.OnEvent)('rtm.message.new'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleRTMNewMessage", null);
__decorate([
    (0, event_emitter_1.OnEvent)('rtm.email.new'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleRTMEmailNew", null);
__decorate([
    (0, event_emitter_1.OnEvent)('rtm.message.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleRTMMessageRead", null);
__decorate([
    (0, event_emitter_1.OnEvent)('rtm.dialog.limit.changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleRTMDialogLimitChanged", null);
__decorate([
    (0, event_emitter_1.OnEvent)('shift.ended'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatsGateway.prototype, "handleShiftEnded", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatsGateway.prototype, "join", null);
exports.ChatsGateway = ChatsGateway = ChatsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? ['https://anchat.me', 'https://www.anchat.me', 'http://91.98.138.1', 'http://localhost:3000']
                : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000'],
            credentials: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6,
        allowEIO3: true,
        cookie: false
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        rtm_service_1.TalkyTimesRTMService,
        chat_access_service_1.ChatAccessService])
], ChatsGateway);
//# sourceMappingURL=chats.gateway.js.map