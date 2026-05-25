#!/usr/bin/env node
/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — MCP Server Entry Point (STDIO transport) */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CastScanSchema,
  CastFullSchema,
  CastReportSchema,
  handleCastScan,
  handleCastFull,
  handleCastReport,
} from './mcp/tools.js';

const server = new McpServer({
  name: 'cast-swarm',
  version: '1.0.0',
});

// ── Tool: cast_scan ──────────────────────────────────────
server.tool(
  'cast_scan',
  'Run a quick CAST analysis on a source directory. Deploys a small swarm of Claude agents to find bugs, security issues, and code quality problems. Default: 5 agents (~$0.40).',
  CastScanSchema.shape,
  async ({ directory, agentCount, model }) => {
    try {
      const result = await handleCastScan({ directory, agentCount: agentCount ?? 5, model });
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `CAST scan failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: cast_full ──────────────────────────────────────
server.tool(
  'cast_full',
  'Run a full 100-agent CAST analysis. Comprehensive code review across 5 squads: Security, Logic, Robustness, Performance, and Data Integrity. Cost: ~$8.',
  CastFullSchema.shape,
  async ({ directory, model }) => {
    try {
      const result = await handleCastFull({ directory, model });
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `CAST full analysis failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: cast_report ────────────────────────────────────
server.tool(
  'cast_report',
  'Read results from a previous CAST analysis. View findings from .cast-output/cast-report.json, optionally filtered by severity.',
  CastReportSchema.shape,
  async ({ directory, severity, limit }) => {
    try {
      const result = handleCastReport({ directory, severity, limit: limit ?? 20 });
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to read report: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── Start Server ─────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[CAST MCP] Server started on STDIO');
}

main().catch(err => {
  console.error(`[CAST MCP] Fatal error: ${err.message}`);
  process.exit(1);
});
