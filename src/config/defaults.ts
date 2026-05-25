/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** Default configuration values for CAST */
export const DEFAULTS = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
  concurrency: 4,
  batchDelayMs: 5000,
  maxRetries: 3,
  retryDelayMs: 15000,
  agentCount: 5,
  srcRoot: '.',
  outputDir: '.cast-output',
  appName: '',      // auto-detect from package.json
  appDescription: '',
  exclude: [] as string[],
  include: [] as string[],
};
