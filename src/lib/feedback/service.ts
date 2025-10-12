import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database, Json, TablesInsert, Tables } from '@supabase/types';

type SupabaseClient = ReturnType<typeof getServiceSupabaseClient>;

// Type aliases for mission_feedback table
type MissionFeedbackInsert = TablesInsert<'mission_feedback'>;
type MissionFeedbackRow = Tables<'mission_feedback'>;

export type PersistMissionFeedbackParams = {
  tenantId: string;
  missionId: string;
  artifactId?: string;
  rating?: number;
  feedbackText?: string;
  learningSignals?: Record<string, unknown>;
};

export type PersistMissionFeedbackResult = {
  id: string;
  missionId: string;
  tenantId: string;
  artifactId: string | null;
  rating: number | null;
  feedbackText: string | null;
  learningSignals: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function persistMissionFeedback(
  params: PersistMissionFeedbackParams,
): Promise<PersistMissionFeedbackResult> {
  const supabase = getServiceSupabaseClient();

  const insertPayload: MissionFeedbackInsert = {
    mission_id: params.missionId,
    tenant_id: params.tenantId,
    artifact_id: params.artifactId ?? null,
    rating: params.rating ?? null,
    feedback_text: params.feedbackText ?? null,
    learning_signals: (params.learningSignals ?? {}) as Json,
  };

  const { data, error } = await supabase
    .from('mission_feedback')
    .insert(insertPayload as MissionFeedbackInsert)
    .select(
      'id, mission_id, tenant_id, artifact_id, rating, feedback_text, learning_signals, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to persist mission feedback');
  }

  await emitTelemetry(
    supabase,
    params.tenantId,
    'mission_feedback_submitted',
    {
      rating: params.rating ?? null,
      has_artifact_id: Boolean(params.artifactId),
      text_length: params.feedbackText?.length ?? 0,
      learning_signals_keys: Object.keys(params.learningSignals ?? {}),
    },
    params.missionId,
  );

  const row = data as MissionFeedbackRow;
  const learningSignals =
    ((row.learning_signals as Record<string, unknown> | null | undefined) ?? {}) as Record<
      string,
      unknown
    >;

  return {
    id: row.id,
    missionId: row.mission_id,
    tenantId: row.tenant_id,
    artifactId: row.artifact_id,
    rating: row.rating,
    feedbackText: row.feedback_text,
    learningSignals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function submitFeedback(
  params: PersistMissionFeedbackParams,
): Promise<PersistMissionFeedbackResult> {
  return persistMissionFeedback(params);
}

type TelemetryPayload = Record<string, unknown>;

async function emitTelemetry(
  supabase: SupabaseClient,
  tenantId: string,
  eventName: string,
  eventData: TelemetryPayload,
  missionId?: string,
): Promise<void> {
  await supabase.from('mission_events').insert({
    tenant_id: tenantId,
    mission_id: missionId ?? null,
    event_name: eventName,
    event_payload: eventData as Json,
  } as Database['public']['Tables']['mission_events']['Insert']);
}
