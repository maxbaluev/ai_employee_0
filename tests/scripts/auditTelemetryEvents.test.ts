import { describe, expect, it } from 'vitest';

import {
  analyzeSources,
  parseEventCatalog,
  type SourceFile,
} from '../../scripts/audit_telemetry_events.ts';

const SAMPLE_DOC = `
### 3.1 Stage 0 — Home (Mission Launcher)
| Event | Triggered By | Context Fields | Analytics Use |
| --- | --- | --- | --- |
| mission_viewed | Workspace shell renders mission list | mission_id, tenantId, stage, persona | Track entry points |

### 3.2 Stage 1 — Define
| Event | Triggered By | Context Fields | Analytics Use |
| --- | --- | --- | --- |
| brief_item_modified | Chip edit (UI) | chip_type, edit_type, token_diff, aliases (\`brief_field_edited\`) | Prompt tuning |
| mission_brief_locked | Owner locks brief | mission_id, tenantId, stage, persona | Stage completion |

### 3.8 Cross-Stage & Platform
| Event | Triggered By | Context Fields | Analytics Use |
| --- | --- | --- | --- |
| workspace_stream_open | CopilotKit SSE connection | mission_id, tenantId, stage, persona | Streaming health |
`;

describe('parseEventCatalog', () => {
  it('extracts canonical events and aliases from documentation', () => {
    const catalog = parseEventCatalog(SAMPLE_DOC);

    expect(catalog.events.size).toBe(4);
    expect(catalog.events.get('mission_viewed')?.stage).toContain('Stage 0');
    expect(catalog.events.get('brief_item_modified')?.aliases.has('brief_field_edited')).toBe(true);
    expect(catalog.aliasToCanonical.get('brief_field_edited')).toBe('brief_item_modified');
  });
});

describe('analyzeSources', () => {
  const catalog = parseEventCatalog(SAMPLE_DOC);

  it('marks events as present when emitted directly', () => {
    const files: SourceFile[] = [
      {
        path: '/tmp/mission.ts',
        content:
          "telemetry.emit('mission_viewed', { mission_id: '1', tenantId: 't', stage: 'HOME', persona: 'RevOps' });",
      },
    ];

    const analysis = analyzeSources(catalog, files);

    expect(analysis.missingEvents).toContain('brief_item_modified');
    expect(analysis.missingEvents).toContain('mission_brief_locked');
    expect(analysis.missingEvents).toContain('workspace_stream_open');
    expect(analysis.missingEvents).not.toContain('mission_viewed');
    expect(analysis.orphanEvents.length).toBe(0);
  });

  it('resolves aliases back to canonical event names', () => {
    const files: SourceFile[] = [
      {
        path: '/tmp/alias.ts',
        content:
          "telemetry.emit('brief_field_edited', { mission_id: '1', tenantId: 't', stage: 'DEFINE', persona: 'RevOps' });",
      },
    ];

    const analysis = analyzeSources(catalog, files);

    expect(analysis.missingEvents).toContain('mission_viewed');
    expect(analysis.missingEvents).not.toContain('brief_item_modified');
    expect(analysis.orphanEvents.length).toBe(0);
  });

  it('flags context gaps when required fields missing', () => {
    const files: SourceFile[] = [
      {
        path: '/tmp/missing_context.ts',
        content: "telemetry.emit('mission_viewed', { mission_id: '1' });",
      },
    ];

    const analysis = analyzeSources(catalog, files);

    expect(analysis.contextIssues.length).toBe(1);
    expect(analysis.contextIssues[0]?.missingFields).toContain('tenantId');
  });
});

