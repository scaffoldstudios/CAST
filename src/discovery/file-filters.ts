/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** Default ignore patterns for source file scanning */

export const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'vendor', 'coverage', '.cache',
  '.turbo', '.vercel', '.netlify', 'target', 'bin', 'obj',
  '.svn', '.hg', '.idea', '.vscode', '.DS_Store',
  '.cast-output', '.claude',
]);

export const DEFAULT_IGNORE_FILE_PATTERNS = [
  /\.test\./i, /\.spec\./i, /\.d\.ts$/, /\.min\.js$/,
  /\.map$/, /\.lock$/, /\.log$/,
  /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/,
  /^\.env/, /^\.gitignore$/, /^\.eslintrc/, /^\.prettier/,
  /^tsconfig.*\.json$/, /^vite\.config/, /^next\.config/,
  /^webpack\.config/, /^rollup\.config/, /^jest\.config/,
];

export const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java',
  '.c', '.h', '.cpp', '.hpp', '.cc',
  '.rb', '.php', '.swift', '.kt', '.cs',
  '.vue', '.svelte',
]);
