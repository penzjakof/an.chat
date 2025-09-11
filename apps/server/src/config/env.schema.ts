import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  TT_BASE_URL: z.string().min(1, 'TT_BASE_URL is required'),

  DATABASE_URL: z.string().refine(
    (v) => v.startsWith('postgresql://') || v.startsWith('file:'),
    'DATABASE_URL must start with postgresql:// or file:'
  ),
});

export type Env = z.infer<typeof EnvSchema>;


