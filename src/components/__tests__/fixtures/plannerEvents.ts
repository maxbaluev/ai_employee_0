import type { TimelineMessage } from '@/hooks/useTimelineEvents';

export function makePlannerCandidateEvent(overrides: Partial<TimelineMessage> = {}): TimelineMessage {
  return {
    id: 'evt-planner-candidate-1',
    createdAt: '2025-10-10T17:15:00.000Z',
    stage: 'planner_candidate_summary',
    event: 'candidate_summary',
    role: 'assistant',
    label: 'Top play rationale',
    description: 'Top candidate: Re-engage warm accounts (High impact)',
    status: 'complete',
    rawContent: 'Top play summary',
    metadata: {
      title: 'Re-engage warm accounts',
      impact: 'High',
      risk: 'Moderate',
      confidence: 0.78,
      toolkits: ['hubspot', 'gmail'],
      reason_markdown: [
        '### Why “Re-engage warm accounts”',
        '- **Similarity**: 0.74 match to the mission objective',
        '- **Toolkits**: hubspot, gmail',
        '- **Impact**: High',
        '- **Risk**: Moderate',
        '- **Undo plan**: Provide draft outreach for review',
        '- **Guardrail focus**: Maintain professional tone',
      ].join('\n'),
      mode: 'dry_run',
      candidate_index: 0,
    },
    ...overrides,
  } as TimelineMessage;
}

export function makePlannerRankCompleteEvent(overrides: Partial<TimelineMessage> = {}): TimelineMessage {
  return {
    id: 'evt-planner-rank-1',
    createdAt: '2025-10-10T17:14:45.000Z',
    stage: 'planner_rank_complete',
    event: 'rank_complete',
    role: 'assistant',
    label: 'Planner ranked plays',
    description: 'Ranking complete: 3 candidate plays prepared',
    status: 'complete',
    rawContent: 'Ranking complete',
    metadata: {
      candidate_count: 3,
      average_similarity: 0.68,
      primary_toolkits: ['hubspot', 'gmail'],
      toolkit_counts: {
        hubspot: 2,
        gmail: 1,
      },
      latency_ms: 1850,
    },
    ...overrides,
  } as TimelineMessage;
}

export function makePlannerTelemetryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'planner-run-1',
    tenant_id: '00000000-0000-0000-0000-000000000000',
    mission_id: '11111111-1111-1111-1111-111111111111',
    latency_ms: 1850,
    candidate_count: 3,
    embedding_similarity_avg: 0.68,
    primary_toolkits: ['hubspot', 'gmail'],
    mode: 'dry_run',
    metadata: {
      objective: 'Warm dormant accounts for Q4 pipeline',
      audience: 'Revenue operations',
    },
    created_at: '2025-10-10T17:14:45.000Z',
    ...overrides,
  };
}

