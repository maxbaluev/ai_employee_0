#!/usr/bin/env ts-node

import { spawnSync } from 'node:child_process';

const pattern = '(fallback_generated|_fallback_|GATE_GA_DEFAULT_TENANT_ID)';
const excludeDirs = ['node_modules', '.venv', '.git', 'dist', 'build'];

const args = ['-rn', '--color=never', pattern, '.'];

const result = spawnSync('rg', args, {
  stdio: 'pipe',
  encoding: 'utf-8',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

const output = result.stdout.trim();

if (!output) {
  console.log('No fallback patterns detected.');
  process.exit(0);
}

console.error('Fallback patterns detected:\n');
console.error(output);
process.exit(1);
