import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database, Json } from '@supabase/types';

type SupabaseClient = ReturnType<typeof getServiceSupabaseClient>;

type SafeguardType = 'tone' | 'quiet_hours' | 'escalation' | 'budget';

export type IntakeInput = {
  rawText: string;
  links?: string[];
  tenantId: string;
  missionId?: string;
};

export type KPI = {
  label: string;
  target?: string;
};

export type GeneratedSafeguard = {
  id: string | null;
  hintType: SafeguardType;
  text: string;
  confidence: number;
  status: 'suggested' | 'accepted' | 'edited' | 'rejected';
};

export type IntakeChips = {
  objective: string;
  audience: string;
  kpis: KPI[];
  safeguardHints: GeneratedSafeguard[];
  confidence: number;
  source: 'gemini' | 'fallback';
};

export type IntakeResult = {
  missionId: string;
  chips: IntakeChips;
};

type TelemetryPayload = Record<string, unknown>;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const DEFAULT_REGEN_LIMIT = Number.parseInt(process.env.MISSION_REGEN_LIMIT ?? '3', 10) || 3;

export class RegenerationLimitError extends Error {
  constructor(
    public readonly field: 'objective' | 'audience' | 'kpis' | 'safeguards',
    public readonly limit: number = DEFAULT_REGEN_LIMIT,
  ) {
    super(`Regeneration limit reached for ${field}. Please edit manually.`);
    this.name = 'RegenerationLimitError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateIntake(input: IntakeInput): Promise<IntakeResult> {
  const supabase = getServiceSupabaseClient();

  await emitTelemetry(supabase, input.tenantId, 'intent_submitted', {
    input_chars: input.rawText.length,
    link_count: input.links?.length ?? 0,
  });

  const generated =
    (await generateWithGemini(input)) ?? generateWithFallback(input.rawText, input.links);

  const guardrailSummary = generated.safeguardHints.map((hint) => hint.text).join('\n');

  const missionId = await upsertObjective({
    supabase,
    tenantId: input.tenantId,
    missionId: input.missionId,
    objective: generated.objective,
    audience: generated.audience,
    guardrailSummary,
    metadata: {
      source: generated.source,
      kpis: generated.kpis,
    },
  });

  const metadata = await persistMissionMetadata({
    supabase,
    tenantId: input.tenantId,
    missionId,
    chips: generated,
  });

  const safeguardHints = await persistSafeguards({
    supabase,
    tenantId: input.tenantId,
    missionId,
    hints: generated.safeguardHints,
    source: generated.source,
  });

  await emitTelemetry(supabase, input.tenantId, 'brief_generated', {
    mission_id: missionId,
    source: generated.source,
    confidence_scores: {
      overall: generated.confidence,
      fields: metadata.fieldConfidences,
    },
    generated_fields: metadata.fields,
  });

  return {
    missionId,
    chips: {
      ...generated,
      safeguardHints,
    },
  };
}

export async function regenerateField(params: {
  missionId: string;
  tenantId: string;
  field: 'objective' | 'audience' | 'kpis' | 'safeguards';
  context?: string;
}): Promise<IntakeChips> {
  const { missionId, tenantId, field, context } = params;
  const supabase = getServiceSupabaseClient();

  await ensureRegenerationAllowance({ supabase, tenantId, missionId, field });

  const baseText = context ?? (await fetchCurrentMissionSummary(supabase, missionId, tenantId));
  const generated = generateWithFallback(baseText, undefined);

  if (field === 'objective' || field === 'audience') {
    await upsertObjective({
      supabase,
      tenantId,
      missionId,
      objective: field === 'objective' ? generated.objective : undefined,
      audience: field === 'audience' ? generated.audience : undefined,
    });

    await persistMissionMetadata({
      supabase,
      tenantId,
      missionId,
      chips: generated,
      fields: [field],
      incrementGeneration: true,
    });
  }

  if (field === 'kpis') {
    await persistMissionMetadata({
      supabase,
      tenantId,
      missionId,
      chips: generated,
      fields: ['kpis'],
      incrementGeneration: true,
    });
  }

  if (field === 'safeguards') {
    await persistSafeguards({
      supabase,
      tenantId,
      missionId,
      hints: generated.safeguardHints,
      source: generated.source,
      incrementGeneration: true,
    });
  }

  await emitTelemetry(supabase, tenantId, 'brief_item_modified', {
    mission_id: missionId,
    field,
    action: 'regenerate',
    source: generated.source,
  });

  const updatedSafeguards = await fetchSafeguards(supabase, missionId, tenantId);

  return {
    ...generated,
    safeguardHints: updatedSafeguards,
  };
}

export async function acceptIntake(params: {
  missionId: string;
  tenantId: string;
  fields?: Array<'objective' | 'audience' | 'kpis'>;
  safeguards?: Array<{ id: string; status?: 'accepted' | 'edited' | 'rejected' }>;
}): Promise<void> {
  const { missionId, tenantId, fields, safeguards } = params;
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();

  const acceptedFields = fields?.length ? fields : ['objective', 'audience', 'kpis'];

  await supabase
    .from('mission_metadata')
    .update({ accepted_at: now } as Database['public']['Tables']['mission_metadata']['Update'])
    .eq('mission_id', missionId)
    .eq('tenant_id', tenantId)
    .in('field', acceptedFields);

  if (safeguards?.length) {
    const grouped = safeguards.reduce<Record<'accepted' | 'edited' | 'rejected', string[]>>(
      (acc, item) => {
        const status = item.status ?? 'accepted';
        acc[status]?.push(item.id);
        return acc;
      },
      { accepted: [], edited: [], rejected: [] },
    );

    if (grouped.accepted.length) {
      await supabase
        .from('mission_safeguards')
        .update({ status: 'accepted', accepted_at: now } as Database['public']['Tables']['mission_safeguards']['Update'])
        .eq('mission_id', missionId)
        .eq('tenant_id', tenantId)
        .in('id', grouped.accepted);
    }

    if (grouped.edited.length) {
      await supabase
        .from('mission_safeguards')
        .update({ status: 'edited', accepted_at: now } as Database['public']['Tables']['mission_safeguards']['Update'])
        .eq('mission_id', missionId)
        .eq('tenant_id', tenantId)
        .in('id', grouped.edited);
    }

    if (grouped.rejected.length) {
      await supabase
        .from('mission_safeguards')
        .update({ status: 'rejected', accepted_at: now } as Database['public']['Tables']['mission_safeguards']['Update'])
        .eq('mission_id', missionId)
        .eq('tenant_id', tenantId)
        .in('id', grouped.rejected);
    }
  }

  await emitTelemetry(supabase, tenantId, 'brief_item_modified', {
    mission_id: missionId,
    action: 'accept',
    fields: acceptedFields,
    safeguard_statuses: safeguards ?? [],
  });
}

export async function logTelemetryEvent(params: {
  tenantId: string;
  eventName: string;
  missionId?: string;
  eventData?: TelemetryPayload;
}): Promise<void> {
  const supabase = getServiceSupabaseClient();
  await emitTelemetry(supabase, params.tenantId, params.eventName, params.eventData ?? {}, params.missionId);
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function upsertObjective(params: {
  supabase: SupabaseClient;
  tenantId: string;
  missionId?: string;
  objective?: string;
  audience?: string;
  guardrailSummary?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { supabase, tenantId, missionId, objective, audience, guardrailSummary, metadata } = params;

  if (missionId) {
    await supabase
      .from('objectives')
      .update({
        ...(objective ? { goal: objective } : {}),
        ...(audience ? { audience } : {}),
        ...(guardrailSummary
          ? { guardrails: { notes: guardrailSummary } as Json }
          : {}),
        ...(metadata ? { metadata: metadata as Json } : {}),
      } as Database['public']['Tables']['objectives']['Update'])
      .eq('id', missionId)
      .eq('tenant_id', tenantId);

    return missionId;
  }

  const { data, error } = await supabase
    .from('objectives')
    .insert({
      tenant_id: tenantId,
      goal: objective ?? 'Define mission objective',
      audience: audience ?? 'General audience',
      timeframe: null,
      guardrails: { notes: guardrailSummary ?? '' } as Json,
      status: 'draft',
      metadata: (metadata ?? {}) as Json,
    } as Database['public']['Tables']['objectives']['Insert'])
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Failed to persist mission objective');
  }

  return data.id;
}

async function persistMissionMetadata(params: {
  supabase: SupabaseClient;
  tenantId: string;
  missionId: string;
  chips: IntakeChips;
  fields?: Array<'objective' | 'audience' | 'kpis'>;
  incrementGeneration?: boolean;
}): Promise<{ fieldConfidences: Record<string, number | null>; fields: string[] }> {
  const { supabase, tenantId, missionId, chips, fields, incrementGeneration } = params;
  const targetFields = fields ?? ['objective', 'audience', 'kpis'];
  const confidences: Record<string, number | null> = {};

  for (const field of targetFields) {
    const value =
      field === 'objective'
        ? { text: chips.objective }
        : field === 'audience'
          ? { text: chips.audience }
          : { items: chips.kpis };

    const existing = await supabase
      .from('mission_metadata')
      .select('regeneration_count')
      .eq('mission_id', missionId)
      .eq('tenant_id', tenantId)
      .eq('field', field)
      .maybeSingle();

    const currentCount = existing.data?.regeneration_count ?? 0;
    const nextCount = incrementGeneration ? currentCount + 1 : currentCount;

    const { error } = await supabase
      .from('mission_metadata')
      .upsert(
        {
          mission_id: missionId,
          tenant_id: tenantId,
          field,
          value: value as Json,
          confidence: chips.confidence,
          source: chips.source,
          regeneration_count: nextCount,
          accepted_at: null,
        } as Database['public']['Tables']['mission_metadata']['Insert'],
        { onConflict: 'mission_id,field' },
      );

    if (error) {
      throw new Error('Failed to persist mission metadata');
    }

    confidences[field] = chips.confidence;
  }

  return { fieldConfidences: confidences, fields: targetFields };
}

async function persistSafeguards(params: {
  supabase: SupabaseClient;
  tenantId: string;
  missionId: string;
  hints: GeneratedSafeguard[];
  source: 'gemini' | 'fallback';
  incrementGeneration?: boolean;
}): Promise<GeneratedSafeguard[]> {
  const { supabase, tenantId, missionId, hints, source, incrementGeneration } = params;

  const { data: existingCounts, error: fetchCountError } = await supabase
    .from('mission_safeguards')
    .select('generation_count')
    .eq('mission_id', missionId)
    .eq('tenant_id', tenantId)
    .order('generation_count', { ascending: false })
    .limit(1);

  if (fetchCountError) {
    throw new Error('Failed to fetch safeguard regeneration count');
  }

  const currentCount = existingCounts?.[0]?.generation_count ?? 0;
  const nextCount = incrementGeneration ? currentCount + 1 : currentCount;

  await supabase
    .from('mission_safeguards')
    .delete()
    .eq('mission_id', missionId)
    .eq('tenant_id', tenantId)
    .eq('status', 'suggested');

  if (!hints.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('mission_safeguards')
    .insert(
      hints.map((hint) => ({
        mission_id: missionId,
        tenant_id: tenantId,
        hint_type: hint.hintType,
        suggested_value: { text: hint.text } as Json,
        confidence: hint.confidence,
        status: 'suggested',
        source,
        generation_count: nextCount,
      })) as Database['public']['Tables']['mission_safeguards']['Insert'][],
    )
    .select('id, hint_type, suggested_value, confidence, status');

  if (error) {
    throw new Error('Failed to persist safeguard hints');
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    hintType: row.hint_type as SafeguardType,
    text: extractSafeguardText(row.suggested_value),
    confidence: row.confidence ?? 0,
    status: (row.status as GeneratedSafeguard['status']) ?? 'suggested',
  }));
}

async function ensureRegenerationAllowance(params: {
  supabase: SupabaseClient;
  tenantId: string;
  missionId: string;
  field: 'objective' | 'audience' | 'kpis' | 'safeguards';
}): Promise<void> {
  const currentCount = await fetchRegenerationCount(params);

  if (currentCount >= DEFAULT_REGEN_LIMIT) {
    throw new RegenerationLimitError(params.field, DEFAULT_REGEN_LIMIT);
  }
}

async function fetchRegenerationCount(params: {
  supabase: SupabaseClient;
  tenantId: string;
  missionId: string;
  field: 'objective' | 'audience' | 'kpis' | 'safeguards';
}): Promise<number> {
  const { supabase, tenantId, missionId, field } = params;

  if (field === 'safeguards') {
    const { data, error } = await supabase
      .from('mission_safeguards')
      .select('generation_count')
      .eq('mission_id', missionId)
      .eq('tenant_id', tenantId)
      .order('generation_count', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error('Failed to fetch safeguard regeneration count');
    }

    return data?.[0]?.generation_count ?? 0;
  }

  const { data, error } = await supabase
    .from('mission_metadata')
    .select('regeneration_count')
    .eq('mission_id', missionId)
    .eq('tenant_id', tenantId)
    .eq('field', field)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to fetch mission metadata regeneration count');
  }

  return data?.regeneration_count ?? 0;
}

async function fetchSafeguards(supabase: SupabaseClient, missionId: string, tenantId: string) {
  const { data } = await supabase
    .from('mission_safeguards')
    .select('id, hint_type, suggested_value, confidence, status')
    .eq('mission_id', missionId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    hintType: row.hint_type as SafeguardType,
    text: extractSafeguardText(row.suggested_value),
    confidence: row.confidence ?? 0,
    status: (row.status as GeneratedSafeguard['status']) ?? 'suggested',
  }));
}

async function emitTelemetry(
  supabase: SupabaseClient,
  tenantId: string,
  eventName: string,
  eventData: TelemetryPayload,
  missionId?: string,
) {
  await supabase.from('mission_events').insert({
    tenant_id: tenantId,
    mission_id: missionId ?? null,
    event_name: eventName,
    event_payload: eventData as Json,
  } as Database['public']['Tables']['mission_events']['Insert']);
}

async function fetchCurrentMissionSummary(
  supabase: SupabaseClient,
  missionId: string,
  tenantId: string,
): Promise<string> {
  const { data } = await supabase
    .from('objectives')
    .select('goal, audience')
    .eq('id', missionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!data) {
    return '';
  }

  return `${data.goal ?? ''}\nAudience: ${data.audience ?? ''}`.trim();
}

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

async function generateWithGemini(input: IntakeInput): Promise<IntakeChips | null> {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = buildIntakePrompt(input.rawText, input.links);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }]}],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const text = extractGeminiText(payload);
    if (!text) {
      return null;
    }

    const structured = JSON.parse(text) as Record<string, unknown>;

    const kpis = Array.isArray(structured.kpis)
      ? structured.kpis
          .map((item): KPI | null => {
            if (!item || typeof item !== 'object') {
              return null;
            }

            const record = item as Record<string, unknown>;
            const label = String(record.label ?? '').trim();
            if (!label) {
              return null;
            }

            return {
              label,
              target: optionalString(record.target),
            };
          })
          .filter((item): item is KPI => item !== null)
      : [];

    const safeguardsRaw = Array.isArray(structured.safeguardHints)
      ? structured.safeguardHints
      : [];

    const safeguardHints = safeguardsRaw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const hintType = normaliseSafeguardType(
          String((item as Record<string, unknown>).type ?? '').toLowerCase(),
        );
        if (!hintType) {
          return null;
        }

        const textValue = optionalString((item as Record<string, unknown>).text);
        if (!textValue) {
          return null;
        }

        return {
          id: null,
          hintType,
          text: textValue,
          confidence: clampConfidence((item as Record<string, unknown>).confidence),
          status: 'suggested',
        } as GeneratedSafeguard;
      })
      .filter((item): item is GeneratedSafeguard => Boolean(item));

    const confidence = clampConfidence(structured.confidence);

    return {
      objective: optionalString(structured.objective) ?? 'Define mission objective',
      audience: optionalString(structured.audience) ?? 'General audience',
      kpis,
      safeguardHints,
      confidence,
      source: 'gemini',
    };
  } catch (error) {
    console.error('[intake] Gemini generation failed', error);
    return null;
  }
}

function buildIntakePrompt(rawText: string, links?: string[]): string {
  const linkSection = links?.length ? `\n\nLinks:\n${links.join('\n')}` : '';
  return `You are an AI copilot mission intake assistant. Extract structured mission data from the input below.

Input:
"""
${rawText.trim()}
"""${linkSection}

Respond with strictly valid JSON using this schema:
{
  "objective": "One sentence objective",
  "audience": "Primary audience",
  "kpis": [
    { "label": "string", "target": "string optional" }
  ],
  "safeguardHints": [
    { "type": "tone" | "quiet_hours" | "escalation" | "budget", "text": "string", "confidence": 0.0-1.0 }
  ],
  "confidence": 0.0-1.0
}

Do not add commentary.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gemini SDK response lacks official typings.
function extractGeminiText(response: any): string | null {
  const candidates = response?.candidates;
  if (!Array.isArray(candidates) || !candidates[0]) {
    return null;
  }

  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  const text = parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Part shape controlled by Gemini runtime, not typed in SDK.
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  return text || null;
}

// ---------------------------------------------------------------------------
// Fallback generator
// ---------------------------------------------------------------------------

function generateWithFallback(rawText: string, links?: string[]): IntakeChips {
  const text = rawText.trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  const objective = sentences[0]?.trim() || 'Define mission objective';

  const audienceKeywords: Array<[RegExp, string]> = [
    [/executive/i, 'Executives'],
    [/board/i, 'Board stakeholders'],
    [/customer|client/i, 'Customers'],
    [/marketing|sales|revenue/i, 'Revenue team'],
    [/support|service/i, 'Support team'],
  ];

  const audience =
    audienceKeywords.find(([regex]) => regex.test(text))?.[1] ?? 'General audience';

  const kpis: KPI[] = [
    { label: 'Completion rate', target: '100%' },
  ];

  if (text.split(/\s+/).length > 40) {
    kpis.push({ label: 'Time to value', target: '14 days' });
  }

  const safeguards: GeneratedSafeguard[] = [
    createFallbackSafeguard('tone', 'Maintain warm-professional tone in all communications', 0.75),
    createFallbackSafeguard('quiet_hours', 'Respect quiet hours between 20:00 and 07:00 local time', 0.8),
  ];

  if (/budget|spend|cost/i.test(text)) {
    safeguards.push(
      createFallbackSafeguard('budget', 'Flag actions that exceed the planned budget threshold', 0.7),
    );
  }

  if (/urgent|critical|escalat/i.test(text)) {
    safeguards.push(
      createFallbackSafeguard('escalation', 'Escalate high-risk steps to the governance reviewer', 0.72),
    );
  }

  let confidence = 0.6;
  if (text.length > 160) confidence += 0.1;
  if (links?.length) confidence += 0.05;
  confidence = Math.min(confidence, 0.85);

  return {
    objective,
    audience,
    kpis,
    safeguardHints: safeguards,
    confidence,
    source: 'fallback',
  };
}

function createFallbackSafeguard(
  hintType: SafeguardType,
  text: string,
  confidence: number,
): GeneratedSafeguard {
  return {
    id: null,
    hintType,
    text,
    confidence,
    status: 'suggested',
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return Math.min(Math.max(numeric, 0), 1);
  }
  return 0.7;
}

function normaliseSafeguardType(value: string): SafeguardType | null {
  if (value === 'tone' || value === 'quiet_hours' || value === 'escalation' || value === 'budget') {
    return value;
  }
  return null;
}

function extractSafeguardText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const candidate = (value as Record<string, unknown>).text;
    if (typeof candidate === 'string') {
      return candidate;
    }
  }
  return '';
}
