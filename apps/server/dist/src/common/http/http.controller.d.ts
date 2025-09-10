import { ConnectionPoolService } from './connection-pool.service';
export declare class HttpController {
    private readonly connectionPool;
    constructor(connectionPool: ConnectionPoolService);
    getPoolStats(): {
        success: boolean;
        data: {
            timestamp: string;
            status: string;
            efficiency: {
                reuseRatio: number;
                loadFactor: number;
            };
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
    };
    getPoolHealth(): {
        success: boolean;
        data: {
            healthy: boolean;
            status: string;
            metrics: {
                activeSockets: number;
                pendingRequests: number;
                freeSocketsAvailable: number;
            };
            recommendations: (string | null)[];
        };
    };
}
