/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Prompt Builder */

import type { Persona } from './types.js';

export interface PromptContext {
  appName: string;
  appDescription?: string;
  techStack?: string;
}

export function buildSystemPrompt(persona: Persona, context: PromptContext): string {
  const appLine = context.appDescription
    ? `${context.appName}, ${context.appDescription}`
    : context.appName;
  const techLine = context.techStack ? ` built with ${context.techStack}` : '';

  return `You are a senior QA engineer and code reviewer participating in CAST (Coordinated Agent Swarm Testing) for ${appLine}${techLine}.

You have deep expertise as: ${persona.archetype}

Your name: ${persona.name}
Your testing scenario: ${persona.scenario}
Your focus areas: ${persona.focusAreas.join(', ')}

Your job is to perform a thorough static code analysis of the provided source files. Look for real bugs, edge cases, logic errors, security issues, performance problems, and spec violations. Be specific — cite exact file names and line numbers. Do not fabricate issues; only report what you can trace in the code.

You must return ONLY valid JSON (no markdown fences, no commentary outside the JSON). Use this exact schema:

{
  "findings": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "file": "relative/path.ts",
      "line": 123,
      "title": "Short title of the issue",
      "description": "Detailed explanation of the bug or issue",
      "impact": "What happens to the user if this triggers",
      "suggestedFix": "How to fix it",
      "category": "logic-error" | "edge-case" | "security" | "performance" | "type-safety" | "spec-violation" | "data-loss" | "ux-issue" | "error-handling" | "concurrency"
    }
  ],
  "summary": "2-3 sentence overview of your analysis"
}`;
}

export function buildUserPrompt(sourceCode: string, persona: Persona): string {
  return `## Source Code Under Review

${sourceCode}

## Your Mandate

Analyze every file above from the perspective of: ${persona.scenario}

Focus especially on: ${persona.focusAreas.join(', ')}

Find real issues. Be precise with file names and line numbers. Rate severity honestly — CRITICAL means data loss or security breach, HIGH means broken functionality, MEDIUM means degraded experience, LOW means minor issue, INFO means code quality observation.

Return your findings as the JSON schema specified in your instructions. Do not include markdown fences — return raw JSON only.`;
}
