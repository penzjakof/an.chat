import { Controller, Get } from '@nestjs/common';
import { ConnectionPoolService } from './connection-pool.service';

@Controller('api/http')
export class HttpController {
  constructor(private readonly connectionPool: ConnectionPoolService) {}

  @Get('pool-stats')
  getPoolStats() {
    const stats = this.connectionPool.getPoolStats();
    
    return {
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        status: stats.totalActiveSockets > 0 ? 'active' : 'idle',
        efficiency: {
          reuseRatio: stats.totalFreeSockets / (stats.totalActiveSockets + stats.totalFreeSockets + 1),
          loadFactor: stats.totalActiveSockets / 50, // maxSockets = 50
        }
      }
    };
  }

  @Get('pool-health')
  getPoolHealth() {
    const stats = this.connectionPool.getPoolStats();
    
    const isHealthy = 
      stats.totalPendingRequests < 10 && // Не більше 10 запитів в черзі
      stats.totalActiveSockets < 45;     // Не більше 90% від maxSockets

    return {
      success: true,
      data: {
        healthy: isHealthy,
        status: isHealthy ? 'healthy' : 'overloaded',
        metrics: {
          activeSockets: stats.totalActiveSockets,
          pendingRequests: stats.totalPendingRequests,
          freeSocketsAvailable: stats.totalFreeSockets,
        },
        recommendations: isHealthy ? [] : [
          stats.totalPendingRequests >= 10 ? 'High request queue - consider increasing timeout' : null,
          stats.totalActiveSockets >= 45 ? 'High socket usage - consider increasing maxSockets' : null,
        ].filter(Boolean)
      }
    };
  }
}
