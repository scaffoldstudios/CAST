/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Result Aggregator: deduplication, severity sorting, cross-squad scoring */

import type {
  AgentResult, Finding, DeduplicatedFinding, SquadStats,
  AggregatedReport, Severity,
} from './types.js';

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function severityRank(s: Severity): number {
  const idx = SEVERITY_ORDER.indexOf(s);
  return idx === -1 ? 99 : idx;
}

/** Normalize a title to extract key concept words for fuzzy matching. */
function titleKeywords(title: string): string[] {
  const stopwords = new Set([
    'the','a','an','in','on','of','for','to','and','or','is','are','not','no',
    'with','without','when','during','after','before','from','by','may','can',
    'could','should','be','been','being','has','have','had','this','that','it',
    'its','does','do','did','will','would','all','but','if','at','as','into',
  ]);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

/** Jaccard similarity between two keyword sets. */
function titleSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Line proximity threshold for considering two findings as potential duplicates. */
const LINE_PROXIMITY = 15;
/** Minimum Jaccard similarity of title keywords to consider a match. */
const TITLE_SIMILARITY_THRESHOLD = 0.25;

export function aggregate(
  results: AgentResult[],
  opts: { model: string; costPerMTokInput: number; costPerMTokOutput: number; appName: string },
): AggregatedReport {
  const successful = results.filter(r => r.findings.length > 0 || r.summary);
  const failed = results.length - successful.length;

  // Collect all findings with agent metadata
  const allFindings: { finding: Finding; agentId: string; squad: string }[] = [];
  for (const r of results) {
    for (const f of r.findings) {
      allFindings.push({ finding: f, agentId: r.agentId, squad: r.squad });
    }
  }

  // Deduplicate — group by (file, category), then match within ±LINE_PROXIMITY lines
  // using fuzzy title similarity. No bucket boundaries to split nearby findings.
  type Group = { finding: Finding; agents: string[]; squads: Set<string>; keywords: string[]; line: number };

  // First, group all findings by (file, category)
  const fileCatGroups = new Map<string, { finding: Finding; agentId: string; squad: string }[]>();
  for (const entry of allFindings) {
    const key = `${entry.finding.file}::${entry.finding.category}`;
    if (!fileCatGroups.has(key)) fileCatGroups.set(key, []);
    fileCatGroups.get(key)!.push(entry);
  }

  // Within each (file, category) group, merge findings that are within
  // LINE_PROXIMITY lines of each other AND have title similarity >= threshold
  const mergedGroups: Group[] = [];

  for (const [, entries] of fileCatGroups) {
    // Sort by line for efficient proximity scanning
    entries.sort((a, b) => (a.finding.line || 0) - (b.finding.line || 0));

    const localGroups: Group[] = [];

    for (const { finding, agentId, squad } of entries) {
      const kw = titleKeywords(finding.title);
      const line = finding.line || 0;

      // Try to merge with an existing group
      let merged = false;
      for (const group of localGroups) {
        if (
          Math.abs(line - group.line) <= LINE_PROXIMITY &&
          titleSimilarity(kw, group.keywords) >= TITLE_SIMILARITY_THRESHOLD
        ) {
          group.agents.push(agentId);
          group.squads.add(squad);
          // Keep the highest severity / longest description version
          if (severityRank(finding.severity) < severityRank(group.finding.severity)) {
            group.finding = finding;
            group.keywords = kw;
            group.line = line;
          } else if (
            severityRank(finding.severity) === severityRank(group.finding.severity) &&
            finding.description.length > group.finding.description.length
          ) {
            group.finding = finding;
            group.keywords = kw;
            group.line = line;
          }
          merged = true;
          break;
        }
      }

      if (!merged) {
        localGroups.push({
          finding,
          agents: [agentId],
          squads: new Set([squad]),
          keywords: kw,
          line,
        });
      }
    }

    mergedGroups.push(...localGroups);
  }

  // Build the groups map for downstream processing
  const groups = new Map<string, Group>();
  for (let i = 0; i < mergedGroups.length; i++) {
    groups.set(`group-${i}`, mergedGroups[i]);
  }

  // Build deduplicated findings with confidence scores
  const deduped: DeduplicatedFinding[] = [];
  for (const [, group] of groups) {
    const crossSquadBonus = group.squads.size > 1 ? 0.2 * (group.squads.size - 1) : 0;
    const occurrenceBonus = Math.min(group.agents.length * 0.1, 0.5);
    const confidence = Math.min(0.3 + occurrenceBonus + crossSquadBonus, 1.0);

    deduped.push({
      ...group.finding,
      reportedBy: group.agents,
      squadsReporting: [...group.squads],
      confidence,
      occurrences: group.agents.length,
    });
  }

  // Sort: severity first, then confidence descending
  deduped.sort((a, b) => {
    const sevDiff = severityRank(a.severity) - severityRank(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  // Squad stats
  const squadNames = [...new Set(results.map(r => r.squad))];
  const squadStats: SquadStats[] = squadNames.map(squad => {
    const squadResults = results.filter(r => r.squad === squad);
    const squadFindings = squadResults.flatMap(r => r.findings);
    const bySeverity: Record<Severity, number> = {
      CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
    };
    const byCategory: Record<string, number> = {};
    for (const f of squadFindings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }
    return {
      squad,
      agentCount: squadResults.length,
      successCount: squadResults.filter(r => r.findings.length > 0).length,
      failureCount: squadResults.filter(r => r.findings.length === 0 && !r.summary).length,
      totalFindings: squadFindings.length,
      bySeverity,
      byCategory,
    };
  });

  // File heatmap — which files have the most findings
  const fileHeatmap: Record<string, number> = {};
  for (const f of deduped) {
    fileHeatmap[f.file] = (fileHeatmap[f.file] || 0) + 1;
  }

  // Token and cost totals
  const totalTokens = results.reduce(
    (acc, r) => ({
      input: acc.input + r.tokenUsage.input,
      output: acc.output + r.tokenUsage.output,
    }),
    { input: 0, output: 0 },
  );
  const totalCost =
    (totalTokens.input / 1_000_000) * opts.costPerMTokInput +
    (totalTokens.output / 1_000_000) * opts.costPerMTokOutput;

  const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    metadata: {
      framework: 'CAST — Coordinated Agent Swarm Testing',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      model: opts.model,
      totalAgents: results.length,
      successfulAgents: successful.length,
      failedAgents: failed,
      totalCost: Math.round(totalCost * 100) / 100,
      totalTokens,
      totalLatencyMs,
      appName: opts.appName,
    },
    findings: deduped,
    squadStats,
    fileHeatmap,
    rawResults: results,
  };
}
