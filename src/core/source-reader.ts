/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** CAST — Source File Reader */

import fs from 'fs';
import path from 'path';

export function readSourceFile(srcRoot: string, relativePath: string): { path: string; content: string } | null {
  const fullPath = path.resolve(srcRoot, relativePath);
  try {
    return { path: relativePath, content: fs.readFileSync(fullPath, 'utf-8') };
  } catch {
    return null;
  }
}

export function readSourceFiles(srcRoot: string, paths: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const p of paths) {
    const result = readSourceFile(srcRoot, p);
    if (result) files.set(result.path, result.content);
  }
  return files;
}

function extToLang(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp',
    '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin', '.cs': 'csharp',
  };
  return map[ext] || '';
}

export function formatSourceForPrompt(files: Map<string, string>, maxChars = 600_000): string {
  const parts: string[] = [];
  let totalChars = 0;
  // Sort by size descending — include biggest (most important) files first
  const sorted = [...files.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [filePath, content] of sorted) {
    const lang = extToLang(filePath);
    const block = `[FILE: ${filePath}]\n\`\`\`${lang}\n${content}\n\`\`\``;
    if (totalChars + block.length > maxChars) {
      const remaining = maxChars - totalChars;
      if (remaining > 1000) {
        const truncated = content.slice(0, remaining - 200);
        parts.push(`[FILE: ${filePath} (TRUNCATED)]\n\`\`\`${lang}\n${truncated}\n// ... truncated ...\n\`\`\``);
      }
      break;
    }
    parts.push(block);
    totalChars += block.length;
  }
  return parts.join('\n\n');
}
