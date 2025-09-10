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
exports.ChatAccessService = void 0;
const common_1 = require("@nestjs/common");
const profiles_service_1 = require("../profiles/profiles.service");
const client_1 = require("@prisma/client");
let ChatAccessService = class ChatAccessService {
    profiles;
    constructor(profiles) {
        this.profiles = profiles;
    }
    async getAccessibleProfiles(auth) {
        if (auth.role === client_1.Role.OWNER) {
            return this.profiles.listByAgencyCode(auth.agencyCode);
        }
        else if (auth.role === client_1.Role.OPERATOR) {
            return this.profiles.listByOperatorAccess(auth.userId, auth.agencyCode);
        }
        return [];
    }
    async canAccessProfile(profileId, auth) {
        if (auth.role === client_1.Role.OWNER) {
            const profiles = await this.profiles.listByAgencyCode(auth.agencyCode);
            return profiles.some(p => p.id === profileId);
        }
        else if (auth.role === client_1.Role.OPERATOR) {
            return this.profiles.hasAccessToProfile(profileId, auth.userId, auth.agencyCode);
        }
        return false;
    }
    async filterDialogsByAccess(dialogs, auth) {
        if (!dialogs || typeof dialogs !== 'object') {
            return dialogs;
        }
        if (dialogs.status === 'error') {
            return dialogs;
        }
        if (!dialogs.dialogs || !Array.isArray(dialogs.dialogs)) {
            return dialogs;
        }
        if (auth.role === client_1.Role.OWNER) {
            return dialogs;
        }
        const accessibleProfiles = await this.getAccessibleProfiles(auth);
        const accessibleProfileIds = accessibleProfiles.map(p => p.profileId).filter(Boolean);
        const filteredDialogs = dialogs.dialogs.filter((dialog) => {
            return accessibleProfileIds.includes(dialog.idUser?.toString());
        });
        return {
            ...dialogs,
            dialogs: filteredDialogs
        };
    }
};
exports.ChatAccessService = ChatAccessService;
exports.ChatAccessService = ChatAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [profiles_service_1.ProfilesService])
], ChatAccessService);
//# sourceMappingURL=chat-access.service.js.map