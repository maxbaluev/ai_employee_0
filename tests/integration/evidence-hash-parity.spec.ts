import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('evidence hash parity', () => {
  it('ensures verify_artifact_hashes reports matching hashes', () => {
    const result = spawnSync('python3', ['scripts/verify_artifact_hashes.py'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });

    if (result.error) {
      throw result.error;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('All artifact hashes verified successfully');
  });
});
