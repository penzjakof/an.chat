"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsModule = void 0;
const common_1 = require("@nestjs/common");
const chats_controller_1 = require("./chats.controller");
const chats_service_1 = require("./chats.service");
const chats_gateway_1 = require("./chats.gateway");
const chat_access_service_1 = require("./chat-access.service");
const providers_module_1 = require("../providers/providers.module");
const auth_module_1 = require("../auth/auth.module");
const profiles_module_1 = require("../profiles/profiles.module");
let ChatsModule = class ChatsModule {
};
exports.ChatsModule = ChatsModule;
exports.ChatsModule = ChatsModule = __decorate([
    (0, common_1.Module)({
        imports: [providers_module_1.ProvidersModule, auth_module_1.AuthModule, profiles_module_1.ProfilesModule],
        controllers: [chats_controller_1.ChatsController],
        providers: [chats_service_1.ChatsService, chats_gateway_1.ChatsGateway, chat_access_service_1.ChatAccessService],
        exports: [chats_service_1.ChatsService],
    })
], ChatsModule);
//# sourceMappingURL=chats.module.js.map