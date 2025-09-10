"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTModule = void 0;
const common_1 = require("@nestjs/common");
const providers_module_1 = require("../providers/providers.module");
const tt_controller_1 = require("./tt.controller");
const tt_compat_controller_1 = require("./tt.compat.controller");
const auth_module_1 = require("../auth/auth.module");
let TTModule = class TTModule {
};
exports.TTModule = TTModule;
exports.TTModule = TTModule = __decorate([
    (0, common_1.Module)({
        imports: [providers_module_1.ProvidersModule, auth_module_1.AuthModule],
        controllers: [tt_controller_1.TTController, tt_compat_controller_1.TTCompatController],
        exports: [providers_module_1.ProvidersModule],
    })
], TTModule);
//# sourceMappingURL=tt.module.js.map