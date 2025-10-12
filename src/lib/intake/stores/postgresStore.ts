import { getServiceSupabaseClient } from '@/lib/supabase/service';

import type { CounterEntry, RegenerationLimiterStore, RegenerationType } from '../regenerationLimiter';

const TABLE_NAME = 'mission_regeneration_limits';

function parseKey(key: string): { tenantId: string; missionId: string; field: RegenerationType } {
  const [tenantId, missionId, rawField] = key.split(':');

  if (!tenantId || !missionId || !rawField) {
    throw new Error(`Invalid limiter key: ${key}`);
  }

  if (!isRegenerationField(rawField)) {
    throw new Error(`Invalid limiter field segment: ${rawField}`);
  }

  return { tenantId, missionId, field: rawField };
}

function isRegenerationField(value: string): value is RegenerationType {
  return value === 'objective' || value === 'audience' || value === 'kpis' || value === 'safeguards';
}

function toCounterEntry(row: { attempt_count: number | null; first_attempt_at: string | null }): CounterEntry {
  const count = typeof row.attempt_count === 'number' ? row.attempt_count : 0;
  const firstAttemptAt = row.first_attempt_at ? new Date(row.first_attempt_at).getTime() : Date.now();

  return { count, firstAttemptAt };
}

export class PostgresRegenerationStore implements RegenerationLimiterStore {
  private readonly client = getServiceSupabaseClient();

  // TODO: Remove the explicit client casts once Supabase types include mission_regeneration_limits.

  async get(key: string): Promise<CounterEntry | undefined> {
    const { tenantId, missionId, field } = parseKey(key);

    const { data, error } = await (this.client as any)
      .from(TABLE_NAME)
      .select('attempt_count, first_attempt_at')
      .match({ tenant_id: tenantId, mission_id: missionId, field })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`[postgres limiter] failed to read counter: ${error.message}`);
    }

    if (!data) {
      return undefined;
    }

    return toCounterEntry(data);
  }

  async set(key: string, entry: CounterEntry): Promise<void> {
    const { tenantId, missionId, field } = parseKey(key);

    const firstAttemptIso = new Date(entry.firstAttemptAt).toISOString();

    const { error } = await (this.client as any)
      .from(TABLE_NAME)
      .upsert(
        {
          tenant_id: tenantId,
          mission_id: missionId,
          field,
          attempt_count: entry.count,
          first_attempt_at: firstAttemptIso,
        },
        { onConflict: 'tenant_id,mission_id,field' },
      );

    if (error) {
      throw new Error(`[postgres limiter] failed to upsert counter: ${error.message}`);
    }
  }

  async reset(key: string): Promise<void> {
    const { tenantId, missionId, field } = parseKey(key);

    const { error } = await (this.client as any)
      .from(TABLE_NAME)
      .delete()
      .match({ tenant_id: tenantId, mission_id: missionId, field });

    if (error) {
      throw new Error(`[postgres limiter] failed to delete counter: ${error.message}`);
    }
  }

  async clear(): Promise<void> {
    const { error } = await (this.client as any)
      .from(TABLE_NAME)
      .delete()
      .neq('tenant_id', '');

    if (error) {
      throw new Error(`[postgres limiter] failed to clear counters: ${error.message}`);
    }
  }
}
