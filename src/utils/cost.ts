/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** Per-model pricing (USD per million tokens) */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
};

export function getModelCost(model: string): { input: number; output: number } {
  // Try exact match first, then prefix match
  if (MODEL_COSTS[model]) return MODEL_COSTS[model];
  for (const [key, cost] of Object.entries(MODEL_COSTS)) {
    if (model.startsWith(key.split('-').slice(0, 3).join('-'))) return cost;
  }
  return { input: 3.0, output: 15.0 }; // default to Sonnet pricing
}
