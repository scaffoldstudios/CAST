/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — MCP Tool Definitions and Handlers */

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { loadConfig, type CliFlags } from '../config/loader.js';
import { scanDirectory } from '../discovery/scanner.js';
import { categorizeFiles } from '../discovery/categorizer.js';
import { buildSquads } from '../generation/squad-builder.js';
import { runCast } from '../core/orchestrator.js';
import { createMcpLogger } from '../utils/logger.js';
import type { AggregatedReport } from '../core/types.js';

// ── Tool Schemas ──────────────────────────────────────────

export const CastScanSchema = z.object({
  directory: z.string().describe('Absolute path to the source directory to analyze'),
  agentCount: z.number().min(1).max(50).default(5).describe('Number of agents to deploy (default: 5)'),
  model: z.string().optional().describe('Claude model to use (default: claude-sonnet-4-20250514)'),
});

export const CastFullSchema = z.object({
  directory: z.string().describe('Absolute path to the source directory to analyze'),
  model: z.string().optional().describe('Claude model to use (default: claude-sonnet-4-20250514)'),
});

export const CastReportSchema = z.object({
  directory: z.string().describe('Path to project directory containing .cast-output/'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional().describe('Filter by minimum severity'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum findings to return'),
});

// ── Tool Handlers ─────────────────────────────────────────

export async function handleCastScan(args: z.infer<typeof CastScanSchema>): Promise<string> {
  const flags: CliFlags = {
    src: args.directory,
    agents: args.agentCount,
    model: args.model,
  };

  return await executeRun(flags);
}

export async function handleCastFull(args: z.infer<typeof CastFullSchema>): Promise<string> {
  const flags: CliFlags = {
    src: args.directory,
    full: true,
    model: args.model,
  };

  return await executeRun(flags);
}

export function handleCastReport(args: z.infer<typeof CastReportSchema>): string {
  const outputDir = path.resolve(args.directory, '.cast-output');
  const reportPath = path.join(outputDir, 'cast-report.json');

  if (!fs.existsSync(reportPath)) {
    return `No CAST report found at ${reportPath}. Run cast_scan first.`;
  }

  let report: AggregatedReport;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch {
    return `Error: CAST report at ${reportPath} is corrupted or unreadable.`;
  }
  if (!report?.metadata || !Array.isArray(report?.findings)) {
    return `Error: CAST report at ${reportPath} has an invalid format.`;
  }
  const m = report.metadata;
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

  // Filter by minimum severity if specified
  let findings = report.findings;
  if (args.severity) {
    const minIdx = severityOrder.indexOf(args.severity);
    findings = findings.filter(f => severityOrder.indexOf(f.severity) <= minIdx);
  }

  // Limit results
  const limited = findings.slice(0, args.limit);

  // Build response
  const sevCounts: Record<string, number> = {};
  for (const sev of severityOrder) {
    sevCounts[sev] = report.findings.filter(f => f.severity === sev).length;
  }

  let response = `# CAST Report: ${m.appName}\n\n`;
  response += `**Timestamp**: ${m.timestamp}\n`;
  response += `**Model**: ${m.model}\n`;
  response += `**Agents**: ${m.totalAgents} (${m.successfulAgents} successful, ${m.failedAgents} failed)\n`;
  response += `**Total Findings**: ${report.findings.length} unique\n`;
  response += `**Cost**: $${m.totalCost.toFixed(2)}\n\n`;

  response += `## Severity Breakdown\n`;
  response += `- CRITICAL: ${sevCounts.CRITICAL}\n`;
  response += `- HIGH: ${sevCounts.HIGH}\n`;
  response += `- MEDIUM: ${sevCounts.MEDIUM}\n`;
  response += `- LOW: ${sevCounts.LOW}\n`;
  response += `- INFO: ${sevCounts.INFO}\n\n`;

  if (limited.length > 0) {
    response += `## Top ${limited.length} Findings${args.severity ? ` (${args.severity}+)` : ''}\n\n`;
    for (const f of limited) {
      response += `### [${f.severity}] ${f.title}\n`;
      response += `**File**: ${f.file}:${f.line}\n`;
      response += `**Category**: ${f.category}\n`;
      response += `**Confidence**: ${Math.round(f.confidence * 100)}%\n`;
      response += `**Reported by**: ${f.occurrences} agent(s) across ${f.squadsReporting.length} squad(s)\n\n`;
      response += `${f.description}\n\n`;
      response += `**Impact**: ${f.impact}\n\n`;
      response += `**Suggested Fix**: ${f.suggestedFix}\n\n---\n\n`;
    }
  }

  response += `\nFull report: ${reportPath}\n`;
  const dashboardPath = path.join(outputDir, 'cast-dashboard.md');
  if (fs.existsSync(dashboardPath)) {
    response += `Dashboard: ${dashboardPath}\n`;
  }

  return response;
}

// ── Shared Execution ──────────────────────────────────────

async function executeRun(flags: CliFlags): Promise<string> {
  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'Error: ANTHROPIC_API_KEY environment variable is required. Set it in your MCP server configuration.';
  }

  const config = loadConfig(flags);
  const logger = createMcpLogger();

  // Discover files
  const files = scanDirectory(config.srcRoot, {
    exclude: config.exclude,
    include: config.include?.length ? config.include : undefined,
  });

  if (files.length === 0) {
    return `No source files found in ${config.srcRoot}. Supported extensions: .ts, .tsx, .js, .jsx, .py, .go, .rs, .java, etc.`;
  }

  logger.log(`[CAST] Found ${files.length} source files in ${config.srcRoot}`);

  // Categorize and build squads
  const fileGroups = categorizeFiles(files);
  const agentCount = flags.full ? 100 : config.agentCount;
  const squads = buildSquads(fileGroups, agentCount);

  const totalAgents = squads.reduce((sum, s) => sum + s.personas.length, 0);
  logger.log(`[CAST] Built ${squads.length} squads with ${totalAgents} total agents`);

  // Run the swarm
  const report = await runCast(squads, config, logger);

  // Build response summary
  const m = report.metadata;
  const findings = report.findings;
  const sevCounts: Record<string, number> = {};
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
    sevCounts[sev] = findings.filter(f => f.severity === sev).length;
  }

  let response = `# CAST Analysis Complete: ${m.appName}\n\n`;
  response += `**Agents**: ${m.totalAgents} (${m.successfulAgents} successful)\n`;
  response += `**Unique Findings**: ${findings.length}\n`;
  response += `**Cost**: $${m.totalCost.toFixed(2)}\n\n`;

  response += `## Severity Breakdown\n`;
  response += `- CRITICAL: ${sevCounts.CRITICAL}\n`;
  response += `- HIGH: ${sevCounts.HIGH}\n`;
  response += `- MEDIUM: ${sevCounts.MEDIUM}\n`;
  response += `- LOW: ${sevCounts.LOW}\n`;
  response += `- INFO: ${sevCounts.INFO}\n\n`;

  // Show top 10 findings
  const top = findings.slice(0, 10);
  if (top.length > 0) {
    response += `## Top Findings\n\n`;
    for (const f of top) {
      response += `### [${f.severity}] ${f.title}\n`;
      response += `**File**: ${f.file}:${f.line}\n`;
      response += `${f.description}\n\n`;
    }
  }

  response += `\nFull reports saved to: ${config.outputDir}\n`;
  response += `View with: cast-swarm --report --output ${config.outputDir}\n`;

  return response;
}
