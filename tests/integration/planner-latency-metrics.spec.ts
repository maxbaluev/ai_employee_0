import { spawnSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);
const repoRoot = process.cwd();

describe('SupabaseClient.insert_planner_run', () => {
  it('normalises planner run payload metadata for Gate G-B telemetry', () => {
    const pythonScript = `
import json
import importlib.util
from pathlib import Path

ROOT = Path.cwd()
spec = importlib.util.spec_from_file_location("supabase_module", ROOT / "agent" / "services" / "supabase.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SupabaseClient = module.SupabaseClient

client = SupabaseClient("https://example.supabase.co", "service-key")
client.allow_writes = True
captured = {}

def fake_write(table, payload, prefer="return=minimal"):
    captured["table"] = table
    captured["payload"] = payload

client._write = fake_write  # type: ignore[attr-defined]

client.insert_planner_run({
    "tenant_id": "00000000-0000-0000-0000-000000000000",
    "mission_id": "00000000-0000-0000-0000-000000000001",
    "latency_ms": 1234,
    "candidate_count": 4,
    "embedding_similarity_avg": 0.73,
    "primary_toolkits": ["crm_sync", "salesforce"],
    "mode": "dry_run",
    "metadata": {
        "objective": "Expand revenue",
        "audience": "Revenue ops",
        "guardrails": ["No production writes"],
    },
    "latency_breakdown": {
        "library_query_ms": 120,
        "composio_discovery_ms": 340,
    },
    "hybrid_score_avg": 0.82,
    "composio_score_avg": 0.71,
    "palette_catalog_size": 18,
})

print(json.dumps(captured))
`.trim();

    const result = spawnSync('python3', ['-c', pythonScript], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');

    const payload = JSON.parse(result.stdout) as {
      table: string;
      payload: Array<Record<string, unknown>>;
    };

    expect(payload.table).toBe('planner_runs');
    expect(Array.isArray(payload.payload)).toBe(true);
    expect(payload.payload).toHaveLength(1);

    const row = payload.payload[0];
    expect(row.latency_ms).toBe(1234);
    expect(row.candidate_count).toBe(4);
    expect(row.primary_toolkits).toEqual(['crm_sync', 'salesforce']);
    expect(row.embedding_similarity_avg).toBeCloseTo(0.73);
    expect(row).not.toHaveProperty('latency_breakdown');
    expect(row).not.toHaveProperty('hybrid_score_avg');
    expect(row).not.toHaveProperty('composio_score_avg');
    expect(row).not.toHaveProperty('palette_catalog_size');

    const metadata = row.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({
      objective: 'Expand revenue',
      audience: 'Revenue ops',
      guardrails: ['No production writes'],
      latency_breakdown: {
        library_query_ms: 120,
        composio_discovery_ms: 340,
      },
      hybrid_score_avg: 0.82,
      composio_score_avg: 0.71,
      palette_catalog_size: 18,
    });
  });
});

describe('GET /api/planner/runs', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const missionId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('applies tenant and mission filters and respects the requested limit', async () => {
    const filters: Array<{ column: string; value: string }> = [];
    let appliedLimit: number | undefined;
    const rows = [{ id: 'planner-run-1' }];

    const builder = {
      eq: vi.fn(function (this: typeof builder, column: string, value: string) {
        filters.push({ column, value });
        return this;
      }),
      order: vi.fn(function (this: typeof builder) {
        return this;
      }),
      limit: vi.fn(async (limit: number) => {
        appliedLimit = limit;
        return { data: rows, error: null };
      }),
    };

    const selectMock = vi.fn(() => builder);
    const fromMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const { GET } = await import('@/app/api/planner/runs/route');

    const response = await GET({
      url: `http://localhost/api/planner/runs?tenantId=${tenantId}&missionId=${missionId}&limit=25`,
    } as unknown as Request);

    expect(fromMock).toHaveBeenCalledWith('planner_runs');
    expect(selectMock).toHaveBeenCalledWith(
      'id, tenant_id, mission_id, latency_ms, candidate_count, embedding_similarity_avg, primary_toolkits, mode, metadata, created_at',
    );
    expect(filters).toEqual([
      { column: 'tenant_id', value: tenantId },
      { column: 'mission_id', value: missionId },
    ]);
    expect(appliedLimit).toBe(25);

    const body = (await response.json()) as { runs: unknown };
    expect(body.runs).toEqual(rows);
  });

  it('defaults mission filter and limit when missionId is omitted', async () => {
    const filters: Array<{ column: string; value: string }> = [];
    let appliedLimit: number | undefined;
    const rows = [{ id: 'planner-run-2' }];

    const builder = {
      eq: vi.fn(function (this: typeof builder, column: string, value: string) {
        filters.push({ column, value });
        return this;
      }),
      order: vi.fn(function (this: typeof builder) {
        return this;
      }),
      limit: vi.fn(async (limit: number) => {
        appliedLimit = limit;
        return { data: rows, error: null };
      }),
    };

    const selectMock = vi.fn(() => builder);
    const fromMock = vi.fn(() => ({ select: selectMock }));

    createClientMock.mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const { GET } = await import('@/app/api/planner/runs/route');

    const response = await GET({
      url: `http://localhost/api/planner/runs?tenantId=${tenantId}`,
    } as unknown as Request);

    expect(filters).toEqual([{ column: 'tenant_id', value: tenantId }]);
    expect(appliedLimit).toBe(50); // default limit

    const body = (await response.json()) as { runs: unknown };
    expect(body.runs).toEqual(rows);
  });
});
