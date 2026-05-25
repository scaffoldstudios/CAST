/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import type { Persona } from '../core/types.js';
import { PERSONA_TEMPLATES } from './persona-templates.js';
import { SQUAD_ARCHETYPES } from './squad-archetypes.js';

/**
 * Scale persona count to match requested agent count.
 * - 1-5: pick 1 per squad (most distinctive)
 * - 6-30: distribute evenly across squads from the pool
 * - 31-100+: generate variations by diversifying focus areas
 */
export function scalePersonas(agentCount: number): Persona[] {
  const squads = SQUAD_ARCHETYPES.map(a => a.id);
  const perSquad = Math.ceil(agentCount / squads.length);
  const personas: Persona[] = [];
  let globalIdx = 0;

  for (const squadId of squads) {
    const templates = PERSONA_TEMPLATES.filter(p => p.squad === squadId);
    const needed = Math.min(perSquad, agentCount - personas.length);
    if (needed <= 0) break;

    for (let i = 0; i < needed; i++) {
      const template = templates[i % templates.length];
      const isVariant = i >= templates.length;
      globalIdx++;

      personas.push({
        id: `${squadId}-${String(globalIdx).padStart(3, '0')}`,
        name: isVariant ? `${template.name} (Variant ${Math.floor(i / templates.length) + 1})` : template.name,
        archetype: template.archetype,
        scenario: isVariant
          ? `${template.scenario} Pay extra attention to subtle, hard-to-spot instances that simpler analysis would miss.`
          : template.scenario,
        focusAreas: isVariant
          ? [...template.focusAreas.slice(1), template.focusAreas[0]] // rotate focus
          : template.focusAreas,
        squad: squadId,
      });
    }
  }

  return personas.slice(0, agentCount);
}
