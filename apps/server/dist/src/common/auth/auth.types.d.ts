import { Role } from '@prisma/client';
export type RequestAuthContext = {
    agencyCode: string;
    role: Role;
    userId: string;
    operatorCode?: string;
};
declare module 'express-serve-static-core' {
    interface Request {
        auth?: RequestAuthContext;
    }
}
