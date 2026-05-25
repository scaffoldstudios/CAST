/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

import type { DiscoveredFile } from './scanner.js';

export interface FileGroup {
  id: string;
  name: string;
  description: string;
  files: string[]; // relative paths
  totalSize: number;
}

/**
 * Group discovered files into squads by top-level directory.
 * Merges small groups and splits large ones to target maxGroups groups.
 */
export function categorizeFiles(files: DiscoveredFile[], maxGroups = 5): FileGroup[] {
  // Group by top-level directory
  const dirMap = new Map<string, DiscoveredFile[]>();
  for (const f of files) {
    const dir = f.directory;
    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push(f);
  }

  // Build initial groups
  let groups: FileGroup[] = [...dirMap.entries()].map(([dir, dirFiles]) => ({
    id: dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    name: dir === '.' ? 'root' : dir,
    description: `Files in ${dir === '.' ? 'root directory' : dir + '/'}`,
    files: dirFiles.map(f => f.relativePath),
    totalSize: dirFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
  }));

  // Sort by size descending
  groups.sort((a, b) => b.totalSize - a.totalSize);

  // If too many groups, merge smallest into "other"
  while (groups.length > maxGroups) {
    const smallest = groups.pop()!;
    const secondSmallest = groups[groups.length - 1];
    // Merge into the last remaining group
    if (secondSmallest.name === 'other') {
      secondSmallest.files.push(...smallest.files);
      secondSmallest.totalSize += smallest.totalSize;
    } else {
      // Create "other" bucket
      groups.push({
        id: 'other',
        name: 'other',
        description: 'Remaining files',
        files: [...secondSmallest.files, ...smallest.files],
        totalSize: secondSmallest.totalSize + smallest.totalSize,
      });
      groups.splice(groups.indexOf(secondSmallest), 1);
    }
    groups.sort((a, b) => b.totalSize - a.totalSize);
  }

  // If too few groups (everything in one dir), split the largest by subdirectory
  if (groups.length < 2 && files.length > 10) {
    const big = groups[0];
    const subDirMap = new Map<string, string[]>();
    for (const f of files) {
      const parts = f.relativePath.split('/');
      const subDir = parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
      if (!subDirMap.has(subDir)) subDirMap.set(subDir, []);
      subDirMap.get(subDir)!.push(f.relativePath);
    }
    if (subDirMap.size > 1) {
      groups = [...subDirMap.entries()].map(([dir, dirFiles]) => ({
        id: dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        name: dir,
        description: `Files in ${dir}/`,
        files: dirFiles,
        totalSize: dirFiles.length * 1000, // approximate
      }));
      groups.sort((a, b) => b.totalSize - a.totalSize);
      // Merge again if too many
      while (groups.length > maxGroups) {
        const smallest = groups.pop()!;
        groups[groups.length - 1].files.push(...smallest.files);
      }
    }
  }

  return groups;
}
