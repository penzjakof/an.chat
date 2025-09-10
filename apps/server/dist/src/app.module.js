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
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const event_emitter_1 = require("@nestjs/event-emitter");
const throttler_1 = require("@nestjs/throttler");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const groups_module_1 = require("./groups/groups.module");
const profiles_module_1 = require("./profiles/profiles.module");
const tt_module_1 = require("./talkytimes/tt.module");
const chats_module_1 = require("./chats/chats.module");
const backup_module_1 = require("./backup/backup.module");
const gallery_module_1 = require("./gallery/gallery.module");
const auth_module_1 = require("./auth/auth.module");
const encryption_validator_service_1 = require("./profiles/encryption-validator.service");
const http_module_1 = require("./common/http/http.module");
const encryption_module_1 = require("./common/encryption/encryption.module");
const shifts_module_1 = require("./shifts/shifts.module");
let AppModule = class AppModule {
    encryptionValidator;
    constructor(encryptionValidator) {
        this.encryptionValidator = encryptionValidator;
    }
    async onModuleInit() {
        try {
            await this.encryptionValidator.validateAndFixProfiles();
            try {
                const rtm = this.rtmService;
                if (rtm) {
                    global.rtmServiceInstance = rtm;
                }
            }
            catch { }
        }
        catch (error) {
            console.error('💥 Помилка при ініціалізації модуля:', error);
        }
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            event_emitter_1.EventEmitterModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'short',
                    ttl: 1000,
                    limit: 10,
                },
                {
                    name: 'medium',
                    ttl: 60000,
                    limit: 100,
                },
                {
                    name: 'long',
                    ttl: 3600000,
                    limit: 1000,
                }
            ]),
            http_module_1.HttpModule,
            encryption_module_1.EncryptionModule,
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            groups_module_1.GroupsModule,
            profiles_module_1.ProfilesModule,
            tt_module_1.TTModule,
            chats_module_1.ChatsModule,
            backup_module_1.BackupModule,
            gallery_module_1.GalleryModule,
            auth_module_1.AuthModule,
            shifts_module_1.ShiftsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            encryption_validator_service_1.EncryptionValidatorService,
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    }),
    __metadata("design:paramtypes", [encryption_validator_service_1.EncryptionValidatorService])
], AppModule);
//# sourceMappingURL=app.module.js.map