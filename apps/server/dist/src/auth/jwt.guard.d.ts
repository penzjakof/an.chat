import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
export declare class JwtAuthGuard implements CanActivate {
    private readonly jwt;
    private readonly reflector;
    private readonly logger;
    constructor(jwt: JwtService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
