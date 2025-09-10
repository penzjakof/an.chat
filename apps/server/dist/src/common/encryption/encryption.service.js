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
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
let EncryptionService = class EncryptionService {
    getKey() {
        const key = process.env.ENCRYPTION_KEY;
        if (!key || key.length < 32) {
            return Buffer.from((key ?? 'dev-encryption-key').padEnd(32, '0').slice(0, 32));
        }
        return Buffer.from(key.slice(0, 32));
    }
    encrypt(plaintext) {
        if (!plaintext)
            return undefined;
        const key = this.getKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from('anchat-profile-creds'));
        let enc = cipher.update(plaintext, 'utf8');
        enc = Buffer.concat([enc, cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, enc]).toString('base64');
    }
    decrypt(ciphertext) {
        if (!ciphertext)
            return undefined;
        try {
            const key = this.getKey();
            const data = Buffer.from(ciphertext, 'base64');
            const iv = data.subarray(0, 16);
            const tag = data.subarray(16, 32);
            const enc = data.subarray(32);
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAAD(Buffer.from('anchat-profile-creds'));
            decipher.setAuthTag(tag);
            let dec = decipher.update(enc);
            dec = Buffer.concat([dec, decipher.final()]);
            return dec.toString('utf8');
        }
        catch {
            return undefined;
        }
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = __decorate([
    (0, common_1.Injectable)()
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map