/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Coordinated Agent Swarm Testing: Orchestrator */

import type { Logger } from '../utils/logger.js';
import type { AggregatedReport, AgentResult, SquadDefinition } from './types.js';
import { readSourceFiles, formatSourceForPrompt } from './source-reader.js';
import { buildSystemPrompt, buildUserPrompt, PromptContext } from './prompt-builder.js';
import { runAgent } from './agent-runner.js';
import { aggregate } from './aggregator.js';
import { writeJsonReport, writeMarkdownDashboard } from './reporter.js';
import { C } from '../utils/colors.js';
import { progressBar } from '../utils/progress.js';
import { getModelCost } from '../utils/cost.js';

export interface CastConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  concurrency: number;
  batchDelayMs: number;
  maxRetries: number;
  retryDelayMs: number;
  srcRoot: string;
  outputDir: string;
  appName: string;
  appDescription?: string;
  techStack?: string;
  isDryRun: boolean;
  squadFilter?: string;
  agentCount: number;
  exclude?: string[];
  include?: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function banner(logger: Logger) {
  logger.log(`
${C.yellow}${C.bold}╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ██████╗ █████╗ ███████╗████████╗                   ║
║  ██╔════╝██╔══██╗██╔════╝╚══██╔══╝                   ║
║  ██║     ███████║███████╗   ██║                       ║
║  ██║     ██╔══██║╚════██║   ██║                       ║
║  ╚██████╗██║  ██║███████║   ██║                       ║
║   ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝                       ║
║                                                      ║
║  Coordinated Agent Swarm Testing                     ║
║  v1.0.0 — cast-swarm                                 ║
║                                                      ║
╚══════════════════════════════════════════════════════╝${C.reset}
`);
}

async function runSquad(
  squad: SquadDefinition,
  config: CastConfig,
  promptContext: PromptContext,
  logger: Logger,
): Promise<AgentResult[]> {
  const personas = config.isDryRun ? [squad.personas[0]] : squad.personas;
  const total = personas.length;

  logger.log(`\n${C.cyan}${C.bold}━━━ Squad: ${squad.name} ━━━${C.reset}`);
  logger.log(`${C.dim}${squad.description}${C.reset}`);
  logger.log(`${C.dim}Agents: ${total} | Files: ${squad.files.join(', ')}${C.reset}\n`);

  // Read source files for this squad
  const sourceFiles = readSourceFiles(config.srcRoot, squad.files);
  const sourcePrompt = formatSourceForPrompt(sourceFiles);

  const results: AgentResult[] = [];
  let done = 0;

  const agentOpts = {
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    maxRetries: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
  };

  // Build agent tasks (deferred — not started yet)
  function makeAgentTask(persona: typeof personas[0]) {
    return async (): Promise<AgentResult> => {
      const systemPrompt = buildSystemPrompt(persona, promptContext);
      const userPrompt = buildUserPrompt(sourcePrompt, persona);

      try {
        const result = await runAgent(
          persona.id,
          squad.name,
          persona.name,
          persona.scenario,
          systemPrompt,
          userPrompt,
          agentOpts,
        );
        done++;
        const findCount = result.findings.length;
        const severity = result.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
        logger.write(
          `\r  ${C.green}${progressBar(done, total)}${C.reset} ` +
          `${C.dim}Latest: ${persona.id} — ${findCount} findings` +
          `${severity > 0 ? ` ${C.red}(${severity} critical/high)${C.reset}` : ''}${C.reset}   `,
        );
        return result;
      } catch (err) {
        done++;
        logger.write(
          `\r  ${C.yellow}${progressBar(done, total)}${C.reset} ` +
          `${C.red}FAIL: ${persona.id} — ${(err as Error).message.slice(0, 60)}${C.reset}   `,
        );
        return {
          agentId: persona.id,
          squad: squad.name,
          persona: persona.name,
          scenario: persona.scenario,
          findings: [],
          summary: `Agent failed: ${(err as Error).message}`,
          tokenUsage: { input: 0, output: 0 },
          latencyMs: 0,
        } as AgentResult;
      }
    };
  }

  // Execute with true concurrency control — only start batchSize at a time
  const tasks = personas.map(p => makeAgentTask(p));
  const batchSize = config.concurrency;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map(fn => fn());
    const batchResults = await Promise.allSettled(batch);
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      }
    }
    // Pause between batches to respect rate limits
    if (i + batchSize < tasks.length) {
      await delay(config.batchDelayMs);
    }
  }

  logger.log(''); // newline after progress bar

  // Squad summary
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const criticals = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.severity === 'CRITICAL').length, 0,
  );
  const highs = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.severity === 'HIGH').length, 0,
  );
  logger.log(
    `  ${C.bold}Squad ${squad.name} complete:${C.reset} ` +
    `${totalFindings} findings ` +
    `(${C.red}${criticals} critical${C.reset}, ${C.yellow}${highs} high${C.reset})`,
  );

  return results;
}

export async function runCast(
  squads: SquadDefinition[],
  config: CastConfig,
  logger: Logger,
): Promise<AggregatedReport> {
  banner(logger);

  if (config.isDryRun) {
    logger.log(`${C.yellow}${C.bold}DRY RUN MODE${C.reset} — 1 agent per squad\n`);
  }
  if (config.squadFilter) {
    logger.log(`${C.yellow}${C.bold}SQUAD FILTER${C.reset} — running only: ${config.squadFilter}\n`);
  }

  logger.log(`${C.dim}Model: ${config.model}${C.reset}`);
  logger.log(`${C.dim}Concurrency: ${config.concurrency} agents per batch${C.reset}`);
  logger.log(`${C.dim}Target: ${config.appName}${C.reset}`);

  const startTime = Date.now();

  const activeSquads = config.squadFilter
    ? squads.filter(s => s.id === config.squadFilter)
    : squads;

  if (activeSquads.length === 0) {
    const available = squads.map(s => s.id).join(', ');
    throw new Error(`No squads matched filter: ${config.squadFilter}. Available: ${available}`);
  }

  const promptContext: PromptContext = {
    appName: config.appName,
    appDescription: config.appDescription,
    techStack: config.techStack,
  };

  const allResults: AgentResult[] = [];

  for (const squad of activeSquads) {
    const squadResults = await runSquad(squad, config, promptContext, logger);
    allResults.push(...squadResults);

    // Pause between squads
    if (squad !== activeSquads[activeSquads.length - 1]) {
      logger.log(`${C.dim}  Cooling down before next squad...${C.reset}`);
      await delay(config.batchDelayMs);
    }
  }

  // ── Aggregation ──────────────────────────────────────────
  logger.log(`\n${C.cyan}${C.bold}━━━ Aggregating Results ━━━${C.reset}\n`);

  const modelCost = getModelCost(config.model);
  const report = aggregate(allResults, {
    model: config.model,
    costPerMTokInput: modelCost.input,
    costPerMTokOutput: modelCost.output,
    appName: config.appName,
  });

  // ── Write Reports ─────────────────────────────────────────
  const jsonPath = writeJsonReport(report, config.outputDir);
  const mdPath = writeMarkdownDashboard(report, config.outputDir);

  // ── Final Summary ─────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const m = report.metadata;

  logger.log(`${C.green}${C.bold}╔══════════════════════════════════════════════════════╗${C.reset}`);
  logger.log(`${C.green}${C.bold}║              CAST RUN COMPLETE                       ║${C.reset}`);
  logger.log(`${C.green}${C.bold}╚══════════════════════════════════════════════════════╝${C.reset}\n`);

  logger.log(`  ${C.bold}Agents${C.reset}:       ${m.totalAgents} (${m.successfulAgents} successful, ${m.failedAgents} failed)`);
  logger.log(`  ${C.bold}Findings${C.reset}:     ${report.findings.length} unique (deduplicated)`);

  const sevLine = [
    report.findings.filter(f => f.severity === 'CRITICAL').length + ' critical',
    report.findings.filter(f => f.severity === 'HIGH').length + ' high',
    report.findings.filter(f => f.severity === 'MEDIUM').length + ' medium',
    report.findings.filter(f => f.severity === 'LOW').length + ' low',
    report.findings.filter(f => f.severity === 'INFO').length + ' info',
  ].join(', ');
  logger.log(`  ${C.bold}Severity${C.reset}:     ${sevLine}`);

  logger.log(`  ${C.bold}Cost${C.reset}:         $${m.totalCost.toFixed(2)}`);
  logger.log(`  ${C.bold}Tokens${C.reset}:       ${(m.totalTokens.input + m.totalTokens.output).toLocaleString()}`);
  logger.log(`  ${C.bold}Time${C.reset}:         ${elapsed}s`);
  logger.log(`  ${C.bold}Reports${C.reset}:      ${jsonPath}`);
  logger.log(`                ${mdPath}`);
  logger.log('');

  return report;
}
