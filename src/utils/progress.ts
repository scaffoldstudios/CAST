/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** Render a text progress bar */
export function progressBar(done: number, total: number, width = 30): string {
  const pct = total > 0 ? done / total : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${done}/${total}`;
}
