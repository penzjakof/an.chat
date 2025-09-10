import { OnModuleDestroy } from '@nestjs/common';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
export interface ConnectionPoolConfig {
    maxSockets?: number;
    maxFreeSockets?: number;
    timeout?: number;
    keepAlive?: boolean;
    keepAliveMsecs?: number;
    maxCachedSessions?: number;
}
export declare class ConnectionPoolService implements OnModuleDestroy {
    private readonly logger;
    private httpsAgent;
    private httpAgent;
    constructor();
    getHttpsAgent(): Agent;
    getHttpAgent(): HttpAgent;
    getAgentForUrl(url: string): Agent | HttpAgent;
    getPoolStats(): {
        https: {
            maxSockets: number;
            maxFreeSockets: number;
            sockets: number;
            freeSockets: number;
            requests: number;
        };
        http: {
            maxSockets: number;
            maxFreeSockets: number;
            sockets: number;
            freeSockets: number;
            requests: number;
        };
        totalActiveSockets: number;
        totalFreeSockets: number;
        totalPendingRequests: number;
    };
    logPoolStats(): void;
    onModuleDestroy(): void;
}
