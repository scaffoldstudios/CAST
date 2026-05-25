/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Single Agent Runner (with retry on rate limit) */

import Anthropic from '@anthropic-ai/sdk';
import type { AgentResult, Finding } from './types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runAgent(
  agentId: string,
  squad: string,
  persona: string,
  scenario: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { model: string; maxTokens: number; temperature: number; maxRetries: number; retryDelayMs: number },
): Promise<AgentResult> {
  const start = Date.now();
  let lastError: Error | null = null;
  const anthropic = getClient();

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = opts.retryDelayMs * attempt;
        await delay(backoff);
      }

      const response = await anthropic.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const latencyMs = Date.now() - start;

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Extract JSON from response (handle markdown fences)
      let jsonStr = text;
      const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1];
      }

      let findings: Finding[] = [];
      let summary = '';

      try {
        const parsed = JSON.parse(jsonStr);
        findings = (parsed.findings || []).map((f: Record<string, unknown>, i: number) => ({
          id: `${agentId}-f${i}`,
          severity: f.severity || 'INFO',
          file: f.file || 'unknown',
          line: f.line || 0,
          title: f.title || 'Untitled finding',
          description: f.description || '',
          impact: f.impact || '',
          suggestedFix: f.suggestedFix || f.suggested_fix || '',
          category: f.category || 'logic-error',
        }));
        summary = parsed.summary || '';
      } catch {
        summary = text.slice(0, 500);
      }

      return {
        agentId,
        squad,
        persona,
        scenario,
        findings,
        summary,
        tokenUsage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        latencyMs,
      };
    } catch (err) {
      lastError = err as Error;
      const status = (err as Record<string, unknown>).status as number | undefined;
      // Only retry on rate limit (429) or server errors (5xx)
      if (status === 429 || (status && status >= 500)) {
        continue;
      }
      throw err; // Don't retry on other errors
    }
  }

  // All retries exhausted
  throw lastError || new Error(`Agent ${agentId} failed after ${opts.maxRetries} retries`);
}
