/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULTS } from './defaults.js';
import { CastConfigSchema, type CastConfigFile } from './schema.js';
import type { CastConfig } from '../core/orchestrator.js';

export interface CliFlags {
  src?: string;
  agents?: number;
  model?: string;
  output?: string;
  concurrency?: number;
  config?: string;
  dryRun?: boolean;
  full?: boolean;
  squad?: string;
  report?: boolean;
  help?: boolean;
  version?: boolean;
}

/** Detect app name from package.json in the target directory */
function detectAppName(srcRoot: string): { name: string; description: string } {
  // Walk up from srcRoot to find package.json
  let dir = path.resolve(srcRoot);
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return {
          name: pkg.name || path.basename(dir),
          description: pkg.description || '',
        };
      } catch { /* ignore parse errors */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { name: path.basename(path.resolve(srcRoot)), description: '' };
}

/** Detect tech stack from package.json dependencies */
function detectTechStack(srcRoot: string): string {
  let dir = path.resolve(srcRoot);
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const techs: string[] = [];
        if (deps['typescript'] || deps['tsx']) techs.push('TypeScript');
        if (deps['react'] || deps['react-dom']) techs.push('React');
        if (deps['vue']) techs.push('Vue');
        if (deps['angular'] || deps['@angular/core']) techs.push('Angular');
        if (deps['svelte']) techs.push('Svelte');
        if (deps['next']) techs.push('Next.js');
        if (deps['express']) techs.push('Express');
        if (deps['fastify']) techs.push('Fastify');
        if (deps['node'] || deps['@types/node']) techs.push('Node.js');
        return techs.join(', ') || 'JavaScript';
      } catch { /* ignore */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

/** Load and merge configuration from all sources */
export function loadConfig(flags: CliFlags): CastConfig {
  const srcRoot = path.resolve(flags.src || DEFAULTS.srcRoot);

  // 1. Load cast.config.json if present
  let fileConfig: Partial<CastConfigFile> = {};
  const configPath = flags.config
    ? path.resolve(flags.config)
    : path.join(srcRoot, 'cast.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      fileConfig = CastConfigSchema.parse(raw);
    } catch (err) {
      console.error(`Warning: Invalid cast.config.json: ${(err as Error).message}`);
    }
  }

  // 2. Environment variables
  const envModel = process.env.CAST_MODEL;
  const envAgents = process.env.CAST_AGENTS ? parseInt(process.env.CAST_AGENTS) : undefined;
  const envConcurrency = process.env.CAST_CONCURRENCY ? parseInt(process.env.CAST_CONCURRENCY) : undefined;
  const envOutput = process.env.CAST_OUTPUT_DIR;

  // 3. Merge: defaults < config file < env < CLI flags
  const agentCount = flags.full ? 100
    : flags.dryRun ? 5
    : flags.agents ?? envAgents ?? fileConfig.agentCount ?? DEFAULTS.agentCount;

  // Auto-detect app info
  const detected = detectAppName(srcRoot);
  const techStack = detectTechStack(srcRoot);

  return {
    model: flags.model ?? envModel ?? fileConfig.model ?? DEFAULTS.model,
    maxTokens: fileConfig.maxTokens ?? DEFAULTS.maxTokens,
    temperature: fileConfig.temperature ?? DEFAULTS.temperature,
    concurrency: flags.concurrency ?? envConcurrency ?? fileConfig.concurrency ?? DEFAULTS.concurrency,
    batchDelayMs: fileConfig.batchDelayMs ?? DEFAULTS.batchDelayMs,
    maxRetries: fileConfig.maxRetries ?? DEFAULTS.maxRetries,
    retryDelayMs: fileConfig.retryDelayMs ?? DEFAULTS.retryDelayMs,
    srcRoot,
    outputDir: path.resolve(flags.output ?? envOutput ?? fileConfig.outputDir ?? path.join(srcRoot, DEFAULTS.outputDir)),
    appName: fileConfig.appName ?? detected.name,
    appDescription: fileConfig.appDescription ?? detected.description,
    techStack,
    isDryRun: flags.dryRun ?? false,
    squadFilter: flags.squad,
    agentCount,
    exclude: fileConfig.exclude ?? DEFAULTS.exclude,
    include: fileConfig.include ?? DEFAULTS.include,
  };
}
