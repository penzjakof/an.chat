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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersModule = exports.TALKY_TIMES_PROVIDER = exports.TALKY_TIMES_BASE_URL = void 0;
const common_1 = require("@nestjs/common");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const talkytimes_provider_1 = require("./talkytimes/talkytimes.provider");
const session_service_1 = require("./talkytimes/session.service");
const rtm_service_1 = require("./talkytimes/rtm.service");
const prisma_module_1 = require("../prisma/prisma.module");
const connection_pool_service_1 = require("../common/http/connection-pool.service");
exports.TALKY_TIMES_BASE_URL = 'TALKY_TIMES_BASE_URL';
exports.TALKY_TIMES_PROVIDER = 'TALKY_TIMES_PROVIDER';
let ProvidersModule = class ProvidersModule {
};
exports.ProvidersModule = ProvidersModule;
exports.ProvidersModule = ProvidersModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        providers: [
            session_service_1.TalkyTimesSessionService,
            rtm_service_1.TalkyTimesRTMService,
            { provide: exports.TALKY_TIMES_BASE_URL, useValue: process.env.TT_BASE_URL ?? 'mock:dev' },
            {
                provide: exports.TALKY_TIMES_PROVIDER,
                useFactory: (baseUrl, sessionService, connectionPool) => new talkytimes_provider_1.TalkyTimesProvider(baseUrl, sessionService, connectionPool),
                inject: [exports.TALKY_TIMES_BASE_URL, session_service_1.TalkyTimesSessionService, connection_pool_service_1.ConnectionPoolService]
            },
        ],
        exports: [exports.TALKY_TIMES_PROVIDER, exports.TALKY_TIMES_BASE_URL, session_service_1.TalkyTimesSessionService, rtm_service_1.TalkyTimesRTMService],
    })
], ProvidersModule);
//# sourceMappingURL=providers.module.js.map