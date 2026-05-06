import { z } from 'zod';

export const SiteInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/i, 'Letters, digits, dash, underscore only'),
  cwd: z.string().min(1),
  script: z.string().optional(),
  interpreter: z.string().optional(),
  args: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  env: z.record(z.string()).default({}),
  autorestart: z.boolean().default(true),
  instances: z.number().int().min(1).default(1),
});

export type SiteInput = z.infer<typeof SiteInputSchema>;

export const SiteStatusSchema = z.enum([
  'online',
  'stopping',
  'stopped',
  'launching',
  'errored',
  'one-launch-status',
  'unknown',
]);

export type SiteStatus = z.infer<typeof SiteStatusSchema>;

export const SiteRuntimeSchema = z.object({
  pmId: z.number().nullable(),
  status: SiteStatusSchema,
  pid: z.number().nullable(),
  cpu: z.number(),
  memory: z.number(),
  uptimeMs: z.number().nullable(),
  restarts: z.number(),
  managedByLauncher: z.boolean(),
  outLog: z.string().nullable(),
  errLog: z.string().nullable(),
});

export type SiteRuntime = z.infer<typeof SiteRuntimeSchema>;

export const SiteSchema = SiteInputSchema.extend({
  runtime: SiteRuntimeSchema,
});

export type Site = z.infer<typeof SiteSchema>;
