import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TalkyTimesSessionService } from './session.service';
export declare class TalkyTimesRTMService implements OnModuleInit, OnModuleDestroy {
    private readonly eventEmitter;
    private readonly sessionService;
    private readonly logger;
    private connections;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    private readonly connectionTimeout;
    private isConnecting;
    private readonly rtmLogFilePath;
    private appendRtmLog;
    constructor(eventEmitter: EventEmitter2, sessionService: TalkyTimesSessionService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private cleanup;
    private connect;
    private connectProfile;
    private scheduleReconnectProfile;
    private handleMessage;
    getConnectionStatus(): Record<number, boolean>;
    reconnectAll(): Promise<void>;
    disconnectProfile(profileId: string | number): void;
    subscribeToUser(userId: string): Promise<void>;
    unsubscribeFromUser(userId: string): Promise<void>;
}
