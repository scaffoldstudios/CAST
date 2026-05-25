#!/usr/bin/env node
/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Coordinated Agent Swarm Testing: CLI Entry Point */

import { loadConfig, type CliFlags } from './config/loader.js';
import { scanDirectory } from './discovery/scanner.js';
import { categorizeFiles } from './discovery/categorizer.js';
import { buildSquads } from './generation/squad-builder.js';
import { runCast } from './core/orchestrator.js';
import { createCliLogger } from './utils/logger.js';
import { C } from './utils/colors.js';
import fs from 'fs';
import path from 'path';

const VERSION = '1.0.0';

function banner() {
  console.log(`
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
║  v${VERSION} — Scaffold Studios                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝${C.reset}
`);
}

function help() {
  console.log(`${C.bold}CAST — Coordinated Agent Swarm Testing${C.reset}
Orchestrate Claude AI agents to perform systematic code analysis.

${C.bold}Usage:${C.reset}
  cast-swarm [options]

${C.bold}Options:${C.reset}
  --src <dir>          Source directory to scan (default: current directory)
  --agents <n>         Number of agents to deploy (default: 5)
  --full               Full 100-agent analysis (~$8)
  --dry-run            Quick 5-agent scan (1 per squad)
  --model <model>      Claude model to use (default: claude-sonnet-4-20250514)
  --output <dir>       Output directory (default: <src>/.cast-output)
  --concurrency <n>    Max concurrent agents (default: 4)
  --squad <id>         Run only one squad (security|logic|robustness|performance|data-integrity)
  --config <path>      Path to cast.config.json
  --report             View results from last run
  --help               Show this help message
  --version            Show version

${C.bold}Environment:${C.reset}
  ANTHROPIC_API_KEY    Required. Your Anthropic API key.
  CAST_MODEL           Override default model
  CAST_AGENTS          Override default agent count
  CAST_CONCURRENCY     Override default concurrency
  CAST_OUTPUT_DIR      Override default output directory

${C.bold}Examples:${C.reset}
  cast-swarm --src ./src                    Quick 5-agent scan
  cast-swarm --src ./src --agents 20        Moderate 20-agent scan
  cast-swarm --src ./src --full             Full 100-agent analysis
  cast-swarm --report                       View last results

${C.bold}MCP Server:${C.reset}
  cast-swarm-mcp                            Start as MCP server for Claude Code/Desktop

${C.dim}Requires ANTHROPIC_API_KEY environment variable.${C.reset}
`);
}

function parseArgs(): CliFlags {
  const args = process.argv.slice(2);
  const flags: CliFlags = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const peek = (): string => {
      if (i + 1 >= args.length) {
        console.error(`${C.red}Missing value for ${arg}${C.reset}`);
        process.exit(1);
      }
      return args[++i];
    };
    switch (arg) {
      case '--src':
        flags.src = peek();
        break;
      case '--agents':
        flags.agents = parseInt(peek());
        break;
      case '--model':
        flags.model = peek();
        break;
      case '--output':
        flags.output = peek();
        break;
      case '--concurrency':
        flags.concurrency = parseInt(peek());
        break;
      case '--config':
        flags.config = peek();
        break;
      case '--squad':
        flags.squad = peek();
        break;
      case '--full':
        flags.full = true;
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--report':
        flags.report = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      case '--version':
      case '-v':
        flags.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`${C.red}Unknown option: ${arg}${C.reset}`);
          console.error(`Run 'cast-swarm --help' for usage.`);
          process.exit(1);
        }
    }
  }

  return flags;
}

function showReport(outputDir: string) {
  const reportPath = path.join(outputDir, 'cast-report.json');
  if (!fs.existsSync(reportPath)) {
    console.error(`${C.red}No report found at ${reportPath}${C.reset}`);
    console.error(`Run a CAST scan first: cast-swarm --src ./src`);
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch {
    console.error(`${C.red}Error: Report file is corrupted or unreadable.${C.reset}`);
    process.exit(1);
  }
  if (!report?.metadata || !Array.isArray(report?.findings)) {
    console.error(`${C.red}Error: Report file has an invalid format.${C.reset}`);
    process.exit(1);
  }
  const m = report.metadata;
  const findings = report.findings;

  console.log(`${C.cyan}${C.bold}━━━ CAST Report: ${m.appName || 'Unknown'} ━━━${C.reset}\n`);
  console.log(`  ${C.bold}Timestamp${C.reset}:  ${m.timestamp}`);
  console.log(`  ${C.bold}Model${C.reset}:      ${m.model}`);
  console.log(`  ${C.bold}Agents${C.reset}:     ${m.totalAgents} (${m.successfulAgents} successful, ${m.failedAgents} failed)`);
  console.log(`  ${C.bold}Findings${C.reset}:   ${findings.length} unique (deduplicated)`);
  console.log(`  ${C.bold}Cost${C.reset}:       $${m.totalCost.toFixed(2)}`);

  const sevCounts = {
    CRITICAL: findings.filter((f: Record<string, string>) => f.severity === 'CRITICAL').length,
    HIGH: findings.filter((f: Record<string, string>) => f.severity === 'HIGH').length,
    MEDIUM: findings.filter((f: Record<string, string>) => f.severity === 'MEDIUM').length,
    LOW: findings.filter((f: Record<string, string>) => f.severity === 'LOW').length,
    INFO: findings.filter((f: Record<string, string>) => f.severity === 'INFO').length,
  };
  console.log(`  ${C.bold}Severity${C.reset}:   ${C.red}${sevCounts.CRITICAL} critical${C.reset}, ${C.yellow}${sevCounts.HIGH} high${C.reset}, ${sevCounts.MEDIUM} medium, ${sevCounts.LOW} low, ${C.dim}${sevCounts.INFO} info${C.reset}\n`);

  // Show top 10 findings
  const top = findings.slice(0, 10);
  if (top.length > 0) {
    console.log(`${C.bold}Top findings:${C.reset}\n`);
    for (const f of top) {
      const sevColor = f.severity === 'CRITICAL' ? C.red : f.severity === 'HIGH' ? C.yellow : C.dim;
      console.log(`  ${sevColor}[${f.severity}]${C.reset} ${f.file}:${f.line} — ${f.title}`);
      console.log(`    ${C.dim}${f.description.slice(0, 120)}${C.reset}\n`);
    }
  }

  console.log(`${C.dim}Full report: ${reportPath}${C.reset}`);
  const dashboardPath = path.join(outputDir, 'cast-dashboard.md');
  if (fs.existsSync(dashboardPath)) {
    console.log(`${C.dim}Dashboard:   ${dashboardPath}${C.reset}`);
  }
}

async function main() {
  const flags = parseArgs();

  if (flags.version) {
    console.log(`cast-swarm v${VERSION}`);
    process.exit(0);
  }

  if (flags.help) {
    help();
    process.exit(0);
  }

  // Load config (merges defaults, config file, env vars, and CLI flags)
  const config = loadConfig(flags);

  if (flags.report) {
    showReport(config.outputDir);
    process.exit(0);
  }

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${C.red}Error: ANTHROPIC_API_KEY environment variable is required.${C.reset}`);
    console.error(`Set it with: export ANTHROPIC_API_KEY=sk-ant-...`);
    process.exit(1);
  }

  banner();

  const logger = createCliLogger();

  logger.log(`${C.dim}Target:      ${config.appName}${config.appDescription ? ` — ${config.appDescription}` : ''}${C.reset}`);
  logger.log(`${C.dim}Source:      ${config.srcRoot}${C.reset}`);
  logger.log(`${C.dim}Model:       ${config.model}${C.reset}`);
  logger.log(`${C.dim}Agents:      ${config.isDryRun ? '5 (dry run)' : config.squadFilter ? `filtered to squad: ${config.squadFilter}` : String(flags.full ? 100 : config.agentCount)}${C.reset}`);
  logger.log(`${C.dim}Concurrency: ${config.concurrency} agents per batch${C.reset}`);
  if (config.techStack) {
    logger.log(`${C.dim}Tech stack:  ${config.techStack}${C.reset}`);
  }

  // Phase 1: Discover source files
  logger.log(`\n${C.cyan}${C.bold}━━━ Scanning Source Files ━━━${C.reset}\n`);

  const files = scanDirectory(config.srcRoot, {
    exclude: config.exclude,
    include: config.include?.length ? config.include : undefined,
  });

  if (files.length === 0) {
    logger.log(`${C.red}No source files found in ${config.srcRoot}${C.reset}`);
    logger.log(`${C.dim}Supported extensions: .ts, .tsx, .js, .jsx, .py, .go, .rs, .java, etc.${C.reset}`);
    process.exit(1);
  }

  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  logger.log(`  ${C.bold}Found${C.reset}: ${files.length} source files (${(totalSize / 1024).toFixed(0)} KB)`);

  // Phase 2: Categorize into file groups
  const fileGroups = categorizeFiles(files);
  logger.log(`  ${C.bold}Groups${C.reset}: ${fileGroups.map(g => `${g.name} (${g.files.length} files)`).join(', ')}`);

  // Phase 3: Build squads with personas
  const agentCount = flags.full ? 100 : config.isDryRun ? 5 : config.agentCount;
  const squads = buildSquads(fileGroups, agentCount);

  const activeSquads = config.squadFilter
    ? squads.filter(s => s.id === config.squadFilter)
    : squads;

  if (activeSquads.length === 0) {
    logger.log(`${C.red}No squads matched filter: ${config.squadFilter}${C.reset}`);
    logger.log(`Available: ${squads.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  const totalAgents = activeSquads.reduce((sum, s) => sum + s.personas.length, 0);
  logger.log(`  ${C.bold}Squads${C.reset}: ${activeSquads.length} (${totalAgents} total agents)\n`);

  // Phase 4: Run the swarm
  const report = await runCast(activeSquads, config, logger);

  // Phase 5: Summary
  logger.log(`\n${C.dim}Reports saved to: ${config.outputDir}${C.reset}`);
  logger.log(`${C.dim}View results: cast-swarm --report --output ${config.outputDir}${C.reset}\n`);
}

main().catch(err => {
  console.error(`${C.red}Fatal error: ${err.message}${C.reset}`);
  process.exit(1);
});
