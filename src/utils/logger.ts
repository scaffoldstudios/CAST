/*
 * Copyright 2026 Julie Golston, Scaffold Studios
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE and NOTICE files for full terms.
 */

/** Logger abstraction: stdout for CLI, stderr for MCP */
export interface Logger {
  log(msg: string): void;
  error(msg: string): void;
  write(msg: string): void;  // raw write (for progress bars)
  supportsAnsi: boolean;
}

export function createCliLogger(): Logger {
  return {
    log: (msg: string) => console.log(msg),
    error: (msg: string) => console.error(msg),
    write: (msg: string) => process.stdout.write(msg),
    supportsAnsi: process.stdout.isTTY ?? false,
  };
}

export function createMcpLogger(): Logger {
  return {
    log: (msg: string) => console.error(msg),
    error: (msg: string) => console.error(msg),
    write: (msg: string) => process.stderr.write(msg),
    supportsAnsi: false,
  };
}
