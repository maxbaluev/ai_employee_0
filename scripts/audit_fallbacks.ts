#!/usr/bin/env ts-node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type AllowlistConfig = Record<string, string[]>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ALLOWLIST_PATH = resolve(__dirname, 'fallback_allowlist.json');
const IGNORED_SEGMENTS = ['node_modules', '.git', '.next', '.pnpm'];
const DEFAULT_PATTERNS = [
  'fallback_generated',
  '_fallback_',
  'GATE_GA_DEFAULT_TENANT_ID',
  'gate-ga-default',
  'coordinator_trace_G-A',
  'Manual undo required - toolkit reversal not implemented',
  'Document manual rollback',
];

function loadAllowlist(): AllowlistConfig {
  const contents = readFileSync(ALLOWLIST_PATH, 'utf-8');
  const parsed = JSON.parse(contents) as AllowlistConfig;
  return parsed;
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAllowlist(filePath: string, globs: string[]): boolean {
  if (!globs.length) {
    return false;
  }

  const normalized = toPosixPath(filePath);
  return globs.some((glob) => globToRegex(glob).test(normalized));
}

function hasIgnoredSegment(filePath: string): boolean {
  return IGNORED_SEGMENTS.some((segment) => filePath.includes(`/${segment}/`));
}

function collectViolations(allowlist: AllowlistConfig) {
  const violations: Array<{ pattern: string; file: string; line: string; snippet: string }> = [];
  const patterns = [...new Set([...DEFAULT_PATTERNS, ...Object.keys(allowlist)])];

  for (const pattern of patterns) {
    const args = ['--no-heading', '--with-filename', '--line-number', '--color=never', pattern, '.'];
    const result = spawnSync('rg', args, {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.error) {
      throw result.error;
    }

    const output = (result.stdout ?? '').trim();
    if (!output) {
      continue;
    }

    const matches = output.split('\n').filter(Boolean);
    for (const match of matches) {
      const [file, line, ...rest] = match.split(':');
      const snippet = rest.join(':').trim();
      if (!file || !line) {
        continue;
      }

      let relativePath = toPosixPath(file.replace(`${ROOT}/`, ''));
      if (relativePath.startsWith('./')) {
        relativePath = relativePath.slice(2);
      }

      if (hasIgnoredSegment(relativePath)) {
        continue;
      }

      const allowedGlobs = allowlist[pattern] ?? [];
      if (matchesAllowlist(relativePath, allowedGlobs)) {
        continue;
      }

      violations.push({ pattern, file: relativePath, line, snippet });
    }
  }

  return violations;
}

function main() {
  const allowlist = loadAllowlist();
  const violations = collectViolations(allowlist);

  if (violations.length === 0) {
    console.log('✅ No unallowlisted Gate G-A fallback patterns detected.');
    return;
  }

  console.error('❌ Gate G-A fallback patterns detected outside the allowlist:\n');
  for (const violation of violations) {
    console.error(`- [${violation.pattern}] ${violation.file}:${violation.line}`);
    if (violation.snippet) {
      console.error(`    ${violation.snippet}`);
    }
  }
  process.exit(1);
}

main();
