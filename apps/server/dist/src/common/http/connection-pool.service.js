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
var ConnectionPoolService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPoolService = void 0;
const common_1 = require("@nestjs/common");
const https_1 = require("https");
const http_1 = require("http");
let ConnectionPoolService = ConnectionPoolService_1 = class ConnectionPoolService {
    logger = new common_1.Logger(ConnectionPoolService_1.name);
    httpsAgent;
    httpAgent;
    constructor() {
        const config = {
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 30000,
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxCachedSessions: 100
        };
        this.httpsAgent = new https_1.Agent({
            maxSockets: config.maxSockets,
            maxFreeSockets: config.maxFreeSockets,
            timeout: config.timeout,
            keepAlive: config.keepAlive,
            keepAliveMsecs: config.keepAliveMsecs,
            maxCachedSessions: config.maxCachedSessions,
        });
        this.httpAgent = new http_1.Agent({
            maxSockets: config.maxSockets,
            maxFreeSockets: config.maxFreeSockets,
            timeout: config.timeout,
            keepAlive: config.keepAlive,
            keepAliveMsecs: config.keepAliveMsecs,
        });
        this.logger.log(`🔗 Connection Pool initialized: maxSockets=${config.maxSockets}, keepAlive=${config.keepAlive}`);
    }
    getHttpsAgent() {
        return this.httpsAgent;
    }
    getHttpAgent() {
        return this.httpAgent;
    }
    getAgentForUrl(url) {
        return url.startsWith('https:') ? this.httpsAgent : this.httpAgent;
    }
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
    onModuleDestroy() {
        this.logger.log('🧹 Destroying connection pool...');
        this.httpsAgent.destroy();
        this.httpAgent.destroy();
        this.logger.log('✅ Connection pool destroyed');
    }
};
exports.ConnectionPoolService = ConnectionPoolService;
exports.ConnectionPoolService = ConnectionPoolService = ConnectionPoolService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ConnectionPoolService);
//# sourceMappingURL=connection-pool.service.js.map