import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('planner latency regression guard', () => {
  it('enforces planner latency and similarity thresholds', () => {
    const result = spawnSync('python3', ['scripts/validate_planner_metrics.py'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.error) {
      throw result.error;
    }

    expect(result.status).toBe(0);
  });
});
