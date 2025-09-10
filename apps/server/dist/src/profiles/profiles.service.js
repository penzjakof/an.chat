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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const talkytimes_provider_1 = require("../providers/talkytimes/talkytimes.provider");
const providers_module_1 = require("../providers/providers.module");
const encryption_service_1 = require("../common/encryption/encryption.service");
const session_service_1 = require("../providers/talkytimes/session.service");
let ProfilesService = class ProfilesService {
    prisma;
    talkyTimesProvider;
    encryption;
    sessionService;
    constructor(prisma, talkyTimesProvider, encryption, sessionService) {
        this.prisma = prisma;
        this.talkyTimesProvider = talkyTimesProvider;
        this.encryption = encryption;
        this.sessionService = sessionService;
    }
    async create(params, agencyCode) {
        const { groupId, provider, displayName, credentialLogin, credentialPassword } = params;
        const group = await this.prisma.group.findFirst({
            where: { id: groupId, agency: { code: agencyCode } }
        });
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        let platformProfileId;
        let targetStatus = client_1.ProfileStatus.INACTIVE;
        if (provider === client_1.ProviderSite.TALKYTIMES) {
            if (credentialLogin && credentialPassword) {
                const validation = await this.talkyTimesProvider.validateCredentials(credentialLogin, credentialPassword);
                if (validation.success) {
                    platformProfileId = validation.profileId;
                    targetStatus = client_1.ProfileStatus.ACTIVE;
                }
                else {
                    targetStatus = client_1.ProfileStatus.INACTIVE;
                }
            }
            else {
                targetStatus = client_1.ProfileStatus.INACTIVE;
            }
        }
        const externalId = `${provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return this.prisma.profile.create({
            data: {
                groupId,
                provider,
                externalId,
                displayName,
                credentialLogin,
                credentialPassword: this.encryption.encrypt(credentialPassword),
                profileId: platformProfileId,
                status: targetStatus,
            },
            include: {
                group: true
            }
        });
    }
    listByGroup(groupId) {
        return this.prisma.profile.findMany({
            where: { groupId },
            include: { group: true }
        });
    }
    listByAgencyCode(agencyCode) {
        return this.prisma.profile.findMany({
            where: {
                group: {
                    agency: { code: agencyCode }
                }
            },
            include: {
                group: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async listByOperatorAccess(operatorId, agencyCode) {
        return this.prisma.profile.findMany({
            where: {
                group: {
                    agency: { code: agencyCode },
                    operators: {
                        some: {
                            operatorId: operatorId
                        }
                    }
                }
            },
            include: {
                group: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async hasAccessToProfile(profileId, operatorId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode },
                    operators: {
                        some: {
                            operatorId: operatorId
                        }
                    }
                }
            }
        });
        return !!profile;
    }
    async update(profileId, updates, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: { agency: { code: agencyCode } }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        const updateData = {};
        if (updates.displayName !== undefined) {
            updateData.displayName = updates.displayName;
        }
        if (updates.credentialLogin !== undefined) {
            updateData.credentialLogin = updates.credentialLogin;
        }
        if (updates.credentialPassword !== undefined) {
            updateData.credentialPassword = this.encryption.encrypt(updates.credentialPassword);
        }
        if (updates.groupId) {
            const newGroup = await this.prisma.group.findFirst({
                where: { id: updates.groupId, agency: { code: agencyCode } }
            });
            if (!newGroup) {
                throw new common_1.NotFoundException('New group not found');
            }
            updateData.groupId = updates.groupId;
        }
        return this.prisma.profile.update({
            where: { id: profileId },
            data: updateData,
            include: { group: true }
        });
    }
    async delete(profileId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: { agency: { code: agencyCode } }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        const res = await this.prisma.profile.delete({ where: { id: profileId } });
        try {
            const { TalkyTimesRTMService } = require('../providers/talkytimes/rtm.service');
            const rtm = global?.rtmServiceInstance;
            if (rtm && res.profileId) {
                rtm.disconnectProfile(res.profileId);
            }
        }
        catch { }
        return res;
    }
    async authenticateProfile(profileId, password, agencyCode) {
        console.log(`🔐 Authenticating profile ${profileId} with agencyCode ${agencyCode}`);
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode }
                }
            }
        });
        if (!profile) {
            console.log(`❌ Profile ${profileId} not found for agency ${agencyCode}`);
            throw new common_1.NotFoundException('Profile not found');
        }
        console.log(`✅ Profile found: ${profile.displayName}, credentialLogin: ${profile.credentialLogin}`);
        if (!profile.credentialPassword || !profile.credentialLogin) {
            throw new common_1.BadRequestException('Profile credentials not found');
        }
        const decryptedPassword = this.encryption.decrypt(profile.credentialPassword);
        console.log(`🔓 Decrypted password matches provided: ${decryptedPassword === password}`);
        if (decryptedPassword !== password) {
            console.log(`❌ Password mismatch for profile ${profileId}`);
            throw new common_1.BadRequestException('Invalid password');
        }
        console.log(`🚀 Calling TalkyTimes validateCredentials for ${profile.credentialLogin}`);
        const result = await this.talkyTimesProvider.validateCredentials(profile.credentialLogin, password);
        console.log(`📥 TalkyTimes auth result:`, { success: result.success, error: result.error, profileId: result.profileId });
        if (!result.success) {
            console.log(`❌ TalkyTimes authentication failed: ${result.error}`);
            throw new common_1.BadRequestException(result.error || 'Authentication failed');
        }
        if (result.profileId && result.profileId !== profile.profileId) {
            console.log(`🔄 Updating profileId from ${profile.profileId} to ${result.profileId}`);
            await this.prisma.profile.update({
                where: { id: profileId },
                data: { profileId: result.profileId }
            });
        }
        console.log(`✅ Profile authenticated successfully: ${result.profileId || profile.profileId}`);
        return {
            success: true,
            profileId: result.profileId || profile.profileId,
            message: 'Profile authenticated successfully'
        };
    }
    async getProfileSessionStatus(profileId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode }
                }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        if (!profile.profileId) {
            return {
                authenticated: false,
                message: 'Profile not authenticated'
            };
        }
        const isValid = await this.sessionService.validateSession(profile.profileId);
        return {
            authenticated: isValid,
            profileId: profile.profileId,
            message: isValid ? 'Session is active' : 'Session expired'
        };
    }
    async getProfileData(profileId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, group: { agency: { code: agencyCode } } }
        });
        if (!profile || !profile.profileId) {
            return { success: false, error: 'Profile not found or not authenticated' };
        }
        if (!this.talkyTimesProvider.fetchProfileData) {
            return { success: false, error: 'Profile data fetching not supported' };
        }
        return this.talkyTimesProvider.fetchProfileData(profile.profileId);
    }
    async getClientPhotos(profileId, clientId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, group: { agency: { code: agencyCode } } }
        });
        if (!profile || !profile.profileId) {
            return { success: false, error: 'Profile not found or not authenticated' };
        }
        if (!this.talkyTimesProvider.fetchClientPhotos) {
            return { success: false, error: 'Client photos fetching not supported' };
        }
        return this.talkyTimesProvider.fetchClientPhotos(profile.profileId, clientId);
    }
    async getMyPublicProfile(profileId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, group: { agency: { code: agencyCode } } }
        });
        if (!profile || !profile.profileId) {
            return { success: false, error: 'Profile not found or not authenticated' };
        }
        return this.talkyTimesProvider.fetchMyPublicProfile(profile.profileId);
    }
    async getMyPhotos(profileId, agencyCode) {
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, group: { agency: { code: agencyCode } } }
        });
        if (!profile || !profile.profileId) {
            return { success: false, error: 'Profile not found or not authenticated' };
        }
        return this.talkyTimesProvider.fetchMyPhotos(profile.profileId);
    }
    async getClientPublicProfile(profileId, clientId, agencyCode) {
        console.log(`🔍 DEBUG getClientPublicProfile: profileId=${profileId}, clientId=${clientId}, agencyCode=${agencyCode}`);
        const profile = await this.prisma.profile.findFirst({
            where: { id: profileId, group: { agency: { code: agencyCode } } }
        });
        console.log(`🔍 DEBUG profile found:`, profile ? { id: profile.id, profileId: profile.profileId, groupId: profile.groupId } : null);
        if (!profile || !profile.profileId) {
            return { success: false, error: 'Profile not found or not authenticated' };
        }
        const res = await this.talkyTimesProvider.fetchProfiles(profile.profileId, [clientId]);
        if (!res.success) {
            return { success: false, error: res.error || 'Failed to load client profile' };
        }
        const client = (res.profiles || [])[0];
        return { success: true, profile: client };
    }
    async getGiftLimits(profileId, clientId, agencyCode) {
        console.log(`🎁 Getting gift limits for profile ${profileId}, client ${clientId}, agency ${agencyCode}`);
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode }
                }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        if (!profile.profileId) {
            throw new common_1.BadRequestException('Profile not authenticated');
        }
        return this.talkyTimesProvider.getVirtualGiftLimits(profile.profileId, clientId);
    }
    async getGiftList(profileId, clientId, cursor = '', limit = 30, agencyCode) {
        console.log(`🎁 Getting gift list for profile ${profileId}, client ${clientId}, cursor=${cursor}, limit=${limit}, agency ${agencyCode}`);
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode }
                }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        if (!profile.profileId) {
            throw new common_1.BadRequestException('Profile not authenticated');
        }
        const result = await this.talkyTimesProvider.getVirtualGiftList(profile.profileId, clientId, cursor, limit);
        if (result.success && result.data) {
            console.log(`🎁 ProfilesService returning ${result.data.items?.length || 0} gifts`);
            result.data.items?.slice(0, 2).forEach((item, index) => {
                console.log(`🎁 Gift ${index + 1}: ${item.name}, imageSrc: ${item.imageSrc}`);
            });
        }
        return result;
    }
    async sendGift(profileId, clientId, giftId, message = '', agencyCode) {
        console.log(`🎁 Sending gift ${giftId} from profile ${profileId} to client ${clientId}, message: "${message}"`);
        const profile = await this.prisma.profile.findFirst({
            where: {
                id: profileId,
                group: {
                    agency: { code: agencyCode }
                }
            }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found');
        }
        if (!profile.profileId) {
            throw new common_1.BadRequestException('Profile not authenticated');
        }
        const result = await this.talkyTimesProvider.sendVirtualGift(profile.profileId, clientId, giftId, message);
        console.log(`🎁 Gift send result:`, result);
        return result;
    }
};
exports.ProfilesService = ProfilesService;
exports.ProfilesService = ProfilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(providers_module_1.TALKY_TIMES_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        talkytimes_provider_1.TalkyTimesProvider,
        encryption_service_1.EncryptionService,
        session_service_1.TalkyTimesSessionService])
], ProfilesService);
//# sourceMappingURL=profiles.service.js.map