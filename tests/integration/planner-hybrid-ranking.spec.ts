import { describe, expect, it } from 'vitest';

const ENABLE_STEP3 = process.env.ENABLE_PLANNER_STEP3 === 'true';

describe.skipIf(!ENABLE_STEP3)('Gate G-B planner hybrid ranking', () => {
  it.todo('combines pgvector similarity and Composio scores into a single ordered list');
});
