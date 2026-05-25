/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Coordinated Agent Swarm Testing: Type Definitions */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Category =
  | 'logic-error'
  | 'edge-case'
  | 'security'
  | 'performance'
  | 'type-safety'
  | 'spec-violation'
  | 'data-loss'
  | 'ux-issue'
  | 'error-handling'
  | 'concurrency';

export interface Finding {
  id: string;
  severity: Severity;
  file: string;
  line: number;
  title: string;
  description: string;
  impact: string;
  suggestedFix: string;
  category: Category;
}

export interface AgentResult {
  agentId: string;
  squad: string;
  persona: string;
  scenario: string;
  findings: Finding[];
  summary: string;
  tokenUsage: { input: number; output: number };
  latencyMs: number;
}

export interface Persona {
  id: string;
  name: string;
  archetype: string;
  scenario: string;
  focusAreas: string[];
  squad: string;
}

export interface SquadDefinition {
  name: string;
  id: string;
  description: string;
  files: string[];
  personas: Persona[];
}

export interface DeduplicatedFinding extends Finding {
  reportedBy: string[];
  squadsReporting: string[];
  confidence: number;
  occurrences: number;
}

export interface SquadStats {
  squad: string;
  agentCount: number;
  successCount: number;
  failureCount: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<string, number>;
}

export interface AggregatedReport {
  metadata: {
    framework: string;
    version: string;
    timestamp: string;
    model: string;
    totalAgents: number;
    successfulAgents: number;
    failedAgents: number;
    totalCost: number;
    totalTokens: { input: number; output: number };
    totalLatencyMs: number;
    appName: string;
  };
  findings: DeduplicatedFinding[];
  squadStats: SquadStats[];
  fileHeatmap: Record<string, number>;
  rawResults: AgentResult[];
}
