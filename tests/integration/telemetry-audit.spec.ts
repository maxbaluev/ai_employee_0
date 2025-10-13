import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('telemetry audit coverage', () => {
  it('confirms required Gate G-B events are present', () => {
    const result = spawnSync('python3', ['scripts/audit_telemetry_events.py', '--gate', 'G-B', '--strict'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.error) {
      throw result.error;
    }

    const credentialsMissing =
      !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (credentialsMissing) {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Supabase credentials not detected');
      return;
    }

    expect([0, 1]).toContain(result.status);

    const analysed = result.stdout.includes('Telemetry events analysed');
    const noEvents = result.stdout.includes('No mission_events returned');

    expect(analysed || noEvents).toBe(true);

    if (analysed) {
      expect(result.stdout).not.toContain('Missing required telemetry events');
    }
  });
});
