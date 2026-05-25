/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import { z } from 'zod';

export const CastConfigSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().min(1024).max(16384).optional(),
  temperature: z.number().min(0).max(1).optional(),
  concurrency: z.number().min(1).max(20).optional(),
  batchDelayMs: z.number().min(0).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryDelayMs: z.number().min(0).optional(),
  agentCount: z.number().min(1).max(200).optional(),
  srcRoot: z.string().optional(),
  outputDir: z.string().optional(),
  appName: z.string().optional(),
  appDescription: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  include: z.array(z.string()).optional(),
}).strict();

export type CastConfigFile = z.infer<typeof CastConfigSchema>;
