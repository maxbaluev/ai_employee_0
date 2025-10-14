# Gate G-B API Catalog

**Last updated:** 2025-10-14

This catalog enumerates Gate G-B control plane endpoints, their contracts, and validation notes. Use it alongside `new_docs/todo.md` and `docs/readiness/gate_g_b_telemetry_reference.md` when preparing readiness evidence.

## Stage 3 · Toolkits

### GET `/api/toolkits/recommend`
- **Purpose:** Return curated toolkit recommendations for the active mission by merging cached planner signals, Supabase selections, and live Composio discovery.
- **Source:** `src/app/api/toolkits/recommend/route.ts`
- **Rate limit:** 5 requests per mission per 10 seconds (enforced via `RegenerationLimiter` with key `toolkits_recommend`).
- **Auth:** Requires authenticated Supabase session or explicit `tenantId` query parameter matching the session tenant.
- **Query parameters:**
  - `tenantId` (`UUID`, optional if session resolved). Tenant context used for Supabase lookups.
  - `missionId` (`UUID`, optional). Enables rate limiting and lifts planner cache.
  - `persona` (`string`, optional ≤64 chars). Forwarded to Composio discovery.
  - `industry` (`string`, optional ≤64 chars). Forwarded to Composio discovery.
- **Response `200` body:**
  ```json
  {
    "toolkits": [
      {
        "slug": "github",
        "name": "GitHub",
        "description": "Developer tooling",
        "category": "Developer Tools",
        "noAuth": false,
        "authSchemes": ["oauth"],
        "logo": "https://...",
        "suggestedByPlanner": true,
        "requiresConnectLink": true
      }
    ],
    "selectionDetails": [
      {
        "slug": "github",
        "name": "GitHub",
        "category": "devtools",
        "authMode": "oauth",
        "noAuth": false,
        "undoToken": "...",
        "connectionStatus": "linked"
      }
    ],
    "plannerSuggestion": {
      "runId": "planner-1",
      "createdAt": "2025-10-13T12:01:00Z",
      "impactScore": 0.84,
      "reasonMarkdown": "...",
      "primaryToolkits": ["github"],
      "metadata": {"rank": 1}
    },
    "requestId": "sha1"
  }
  ```
  - Empty discovery payloads still return `200` with `toolkits: []` and `plannerSuggestion: null`.
  - When upstream data is temporarily unavailable a `500` with `{ "error": "Failed to load toolkit recommendations" }` is emitted.
- **Telemetry:** Emits `api_toolkits_recommend_hit` with latency, filter parameters, and planner metadata (see telemetry reference).
- **Tests:**
  - `pnpm vitest run src/lib/toolkits/recommendation.test.ts src/app/api/toolkits/recommend/route.test.ts`
  - Console warnings in the suite are intentional (verifying error-handling paths).
- **Follow-ups:** Document any additional endpoints introduced for Stage 3 in this file; keep rate limits synchronized with `RegenerationLimiter` config.

---

_Consumers:_ Mission intake Stage 3 UI (`src/components/RecommendedToolkits.tsx`) and forthcoming planner agent workflows should reference this contract when stitching toolkit metadata and Connect Link status.

