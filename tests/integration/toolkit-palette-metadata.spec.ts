import { describe, it } from 'vitest';

const ENABLE_STEP3 = process.env.ENABLE_PLANNER_STEP3 === 'true';

describe.skipIf(!ENABLE_STEP3)('Gate G-B planner toolkit palette metadata', () => {
  it.todo('returns and stores palette metadata for recommended toolkits');
});
