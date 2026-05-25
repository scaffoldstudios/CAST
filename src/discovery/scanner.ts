/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_IGNORE_DIRS, DEFAULT_IGNORE_FILE_PATTERNS, SUPPORTED_EXTENSIONS } from './file-filters.js';

export interface DiscoveredFile {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  directory: string; // top-level dir relative to srcRoot
}

export interface ScanOptions {
  exclude?: string[];    // additional dirs to skip
  include?: string[];    // if set, only include these extensions
  maxFileSize?: number;  // skip files larger than this (bytes), default 500KB
}

export function scanDirectory(srcRoot: string, options: ScanOptions = {}): DiscoveredFile[] {
  const absRoot = path.resolve(srcRoot);
  const files: DiscoveredFile[] = [];
  const maxSize = options.maxFileSize ?? 512_000;
  const extraIgnore = new Set(options.exclude || []);
  const includeExts = options.include ? new Set(options.include) : null;

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name) || extraIgnore.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        // Check extension
        if (includeExts ? !includeExts.has(ext) : !SUPPORTED_EXTENSIONS.has(ext)) continue;

        // Check ignore patterns
        if (DEFAULT_IGNORE_FILE_PATTERNS.some(p => p.test(entry.name))) continue;

        // Check file size
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.size > maxSize || stat.size === 0) continue;

        const relativePath = path.relative(absRoot, fullPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        const topDir = parts.length > 1 ? parts[0] : '.';

        files.push({
          relativePath,
          absolutePath: fullPath,
          extension: ext,
          sizeBytes: stat.size,
          directory: topDir,
        });
      }
    }
  }

  walk(absRoot);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
