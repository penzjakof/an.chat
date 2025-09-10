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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpController = void 0;
const common_1 = require("@nestjs/common");
const connection_pool_service_1 = require("./connection-pool.service");
let HttpController = class HttpController {
    connectionPool;
    constructor(connectionPool) {
        this.connectionPool = connectionPool;
    }
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
                    loadFactor: stats.totalActiveSockets / 50,
                }
            }
        };
    }
    getPoolHealth() {
        const stats = this.connectionPool.getPoolStats();
        const isHealthy = stats.totalPendingRequests < 10 &&
            stats.totalActiveSockets < 45;
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
};
exports.HttpController = HttpController;
__decorate([
    (0, common_1.Get)('pool-stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HttpController.prototype, "getPoolStats", null);
__decorate([
    (0, common_1.Get)('pool-health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HttpController.prototype, "getPoolHealth", null);
exports.HttpController = HttpController = __decorate([
    (0, common_1.Controller)('api/http'),
    __metadata("design:paramtypes", [connection_pool_service_1.ConnectionPoolService])
], HttpController);
//# sourceMappingURL=http.controller.js.map