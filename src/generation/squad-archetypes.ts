/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** The 5 fixed analysis squad archetypes */
export interface SquadArchetype {
  id: string;
  name: string;
  description: string;
}

export const SQUAD_ARCHETYPES: SquadArchetype[] = [
  {
    id: 'security',
    name: 'Security Auditors',
    description: 'Hunt for XSS, injection, auth bypass, secrets exposure, prototype pollution, unsafe deserialization, and OWASP Top 10 vulnerabilities',
  },
  {
    id: 'logic',
    name: 'Logic Analysts',
    description: 'Find logic errors, off-by-one bugs, incorrect conditionals, state management flaws, race conditions, and algorithmic mistakes',
  },
  {
    id: 'robustness',
    name: 'Robustness Testers',
    description: 'Test error handling, edge cases, null/undefined safety, boundary conditions, graceful degradation, and failure recovery',
  },
  {
    id: 'performance',
    name: 'Performance Engineers',
    description: 'Identify memory leaks, O(n^2) algorithms, unnecessary re-renders, unbounded growth, missing cleanup, and resource exhaustion',
  },
  {
    id: 'data-integrity',
    name: 'Data Integrity Inspectors',
    description: 'Check data flow correctness, type safety at runtime, serialization fidelity, state consistency, data loss vectors, and storage reliability',
  },
];
