import { OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';
import { ChatAccessService } from './chat-access.service';
export declare class ChatsGateway implements OnModuleInit {
    private readonly jwt;
    private readonly rtmService;
    private readonly chatAccess;
    private readonly logger;
    private userSockets;
    private processedMessageIds;
    private readonly MESSAGE_DEDUP_TTL_MS;
    private processedEmailIds;
    server: Server;
    constructor(jwt: JwtService, rtmService: TalkyTimesRTMService, chatAccess: ChatAccessService);
    onModuleInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleRTMMessage(data: any): void;
    handleRTMNewMessage(data: any): void;
    handleRTMEmailNew(data: any): void;
    handleRTMMessageRead(data: any): void;
    handleRTMDialogLimitChanged(data: any): void;
    handleShiftEnded(data: {
        operatorId: string;
    }): void;
    emitNewMessage(event: {
        dialogId: string;
        payload: any;
    }): void;
    join(data: {
        dialogId: string;
    }, client: Socket): Promise<{
        error: string;
        joined?: undefined;
        userId?: undefined;
    } | {
        joined: string;
        userId: any;
        error?: undefined;
    }>;
}
