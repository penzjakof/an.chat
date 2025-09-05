import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class ActiveShiftGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.auth;
    if (!auth || !auth.userId) return false;

    // Власнику дозволяємо завжди
    if (auth.role === Role.OWNER) return true;

    const hasActive = await this.prisma.shift.findFirst({ where: { operatorId: auth.userId, endedAt: null } });
    return !!hasActive;
  }
}
