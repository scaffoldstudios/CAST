/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import type { SquadDefinition } from '../core/types.js';
import type { FileGroup } from '../discovery/categorizer.js';
import { SQUAD_ARCHETYPES } from './squad-archetypes.js';
import { scalePersonas } from './persona-scaler.js';

/**
 * Build squad definitions by combining:
 * - 5 analysis archetypes (security, logic, robustness, performance, data-integrity)
 * - Discovered file groups
 * - Scaled personas
 *
 * Each squad sees ALL files (differentiation is the analysis lens, not file scope).
 * This maximizes cross-squad corroboration for deduplication.
 */
export function buildSquads(
  fileGroups: FileGroup[],
  agentCount: number,
): SquadDefinition[] {
  const allFiles = fileGroups.flatMap(g => g.files);
  const personas = scalePersonas(agentCount);

  return SQUAD_ARCHETYPES.map(archetype => {
    const squadPersonas = personas.filter(p => p.squad === archetype.id);
    // Skip squads with no personas assigned
    if (squadPersonas.length === 0) return null;

    return {
      name: archetype.name,
      id: archetype.id,
      description: archetype.description,
      files: allFiles, // all squads see all files
      personas: squadPersonas,
    };
  }).filter((s): s is SquadDefinition => s !== null);
}
