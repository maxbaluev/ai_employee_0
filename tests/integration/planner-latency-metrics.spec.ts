import { describe, it } from 'vitest';

const ENABLE_STEP3 = process.env.ENABLE_PLANNER_STEP3 === 'true';

describe.skipIf(!ENABLE_STEP3)('Gate G-B planner latency metrics', () => {
  it.todo('persists planner_runs latency fields and emits telemetry');
});
