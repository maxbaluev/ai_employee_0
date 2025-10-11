import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database, Json } from '@supabase/types';

export type SafeguardEventParams = {
  tenantId: string;
  missionId: string;
  eventType: string;
  details?: Record<string, unknown>;
};

export type MissionEventParams = {
  tenantId: string;
  missionId?: string | null;
  eventName: string;
  eventPayload?: Record<string, unknown>;
};

export async function emitSafeguardEvent(params: SafeguardEventParams): Promise<void> {
  const supabase = getServiceSupabaseClient();

  try {
    await supabase
      .from('safeguard_events')
      .insert({
        tenant_id: params.tenantId,
        mission_id: params.missionId,
        event_type: params.eventType,
        details: (params.details ?? {}) as Json,
      } as Database['public']['Tables']['safeguard_events']['Insert']);
  } catch (error) {
    console.warn('[telemetry:safeguards] emitSafeguardEvent failed', error);
  }
}

export async function emitMissionEvent(params: MissionEventParams): Promise<void> {
  const supabase = getServiceSupabaseClient();

  try {
    await supabase
      .from('mission_events')
      .insert({
        tenant_id: params.tenantId,
        mission_id: params.missionId ?? null,
        event_name: params.eventName,
        event_payload: (params.eventPayload ?? {}) as Json,
      } as Database['public']['Tables']['mission_events']['Insert']);
  } catch (error) {
    console.warn('[telemetry:mission] emitMissionEvent failed', error);
  }
}
