import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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

@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private httpsAgent: Agent;
  private httpAgent: HttpAgent;

  constructor() {
    const config: ConnectionPoolConfig = {
      maxSockets: 50,           // Максимум сокетів на хост
      maxFreeSockets: 10,       // Максимум вільних сокетів
      timeout: 30000,           // 30 секунд timeout
      keepAlive: true,          // Включити keep-alive
      keepAliveMsecs: 30000,    // 30 секунд keep-alive
      maxCachedSessions: 100    // Кеш TLS сесій
    };

    this.httpsAgent = new Agent({
      maxSockets: config.maxSockets,
      maxFreeSockets: config.maxFreeSockets,
      timeout: config.timeout,
      keepAlive: config.keepAlive,
      keepAliveMsecs: config.keepAliveMsecs,
      maxCachedSessions: config.maxCachedSessions,
    });

    this.httpAgent = new HttpAgent({
      maxSockets: config.maxSockets,
      maxFreeSockets: config.maxFreeSockets,
      timeout: config.timeout,
      keepAlive: config.keepAlive,
      keepAliveMsecs: config.keepAliveMsecs,
    });

    this.logger.log(`🔗 Connection Pool initialized: maxSockets=${config.maxSockets}, keepAlive=${config.keepAlive}`);
  }

  /**
   * Отримати HTTPS агент для використання з fetch
   */
  getHttpsAgent(): Agent {
    return this.httpsAgent;
  }

  /**
   * Отримати HTTP агент для використання з fetch
   */
  getHttpAgent(): HttpAgent {
    return this.httpAgent;
  }

  /**
   * Отримати агент для URL (автоматично визначає HTTP/HTTPS)
   */
  getAgentForUrl(url: string): Agent | HttpAgent {
    return url.startsWith('https:') ? this.httpsAgent : this.httpAgent;
  }

  /**
   * Отримати статистику connection pool
   */
  getPoolStats() {
    const httpsStats = {
      maxSockets: this.httpsAgent.maxSockets,
      maxFreeSockets: this.httpsAgent.maxFreeSockets,
      sockets: Object.keys(this.httpsAgent.sockets || {}).length,
      freeSockets: Object.keys(this.httpsAgent.freeSockets || {}).length,
      requests: Object.keys(this.httpsAgent.requests || {}).length,
    };

    const httpStats = {
      maxSockets: this.httpAgent.maxSockets,
      maxFreeSockets: this.httpAgent.maxFreeSockets,
      sockets: Object.keys(this.httpAgent.sockets || {}).length,
      freeSockets: Object.keys(this.httpAgent.freeSockets || {}).length,
      requests: Object.keys(this.httpAgent.requests || {}).length,
    };

    return {
      https: httpsStats,
      http: httpStats,
      totalActiveSockets: httpsStats.sockets + httpStats.sockets,
      totalFreeSockets: httpsStats.freeSockets + httpStats.freeSockets,
      totalPendingRequests: httpsStats.requests + httpStats.requests,
    };
  }

  /**
   * Логування статистики connection pool
   */
  logPoolStats() {
    const stats = this.getPoolStats();
    this.logger.debug(`📊 Connection Pool Stats:`, {
      totalActive: stats.totalActiveSockets,
      totalFree: stats.totalFreeSockets,
      totalPending: stats.totalPendingRequests,
      https: stats.https,
      http: stats.http,
    });
  }

  /**
   * Очистити connection pool при завершенні модуля
   */
  onModuleDestroy() {
    this.logger.log('🧹 Destroying connection pool...');
    
    // Закриваємо всі активні з'єднання
    this.httpsAgent.destroy();
    this.httpAgent.destroy();
    
    this.logger.log('✅ Connection pool destroyed');
  }
}
