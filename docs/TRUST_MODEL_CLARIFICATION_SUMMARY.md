x# Composio Tool Router: Unified Toolkit Execution Interface

**Date:** 2025-10-15 (Revised Staging Update)
**Objective:** Standardize AI Employee Control Plane on Composio Tool Router as the sole mechanism for toolkit operations, with clarified staging flow where Inspector previews connections, Planner establishes OAuth, and Executor verifies and executes

---

## Executive Summary

The AI Employee Control Plane has standardized on the **Composio Tool Router** as the exclusive interface for all toolkit operations. This production-ready meta-tool system provides a three-phase workflow (Discovery, Authentication, Execution) across 500+ toolkits via six meta-tools. The revised staging flow clarifies when OAuth connections are established:

- **Prepare Stage (Inspector):** No-auth discovery + preview anticipated connections
- **Plan & Approve Stage (Planner + Validator):** Formally trigger OAuth after stakeholder approval
- **Execute & Observe Stage (Executor):** Verify and execute with already-established connections (no new OAuth flows)

**Key Decision:** No alternative MCP mechanisms (standard per-toolkit servers, curated bundles) are supported. All toolkit interactions flow through Tool Router's six meta-tools.

---

## Why Tool Router Only?

### 1. Simplification of Agent Architecture

**Before (Multiple MCP Mechanisms):**

```
User Request
  ↓
Coordinator decides: Standard MCP or Tool Router?
  ↓
If Standard MCP:
  - Select per-toolkit server (Gmail, Slack, GitHub...)
  - OR select curated bundle (productivity, developer, sales)
  - Configure authConfigId, allowedTools[], isChatAuth
  - Inspector validates per-server availability
  - Executor routes through selected server
  ↓
If Tool Router:
  - Use meta-tools for discovery, planning, OAuth, execution
  - Inspector uses COMPOSIO_SEARCH_TOOLS
  - Executor uses COMPOSIO_MULTI_EXECUTE_TOOL
```

**After (Tool Router Only):**

```
User Request
  ↓
Inspector: COMPOSIO_SEARCH_TOOLS (no-auth discovery)
  ↓
Planner: COMPOSIO_CREATE_PLAN (multi-step planning)
  ↓
User Approves OAuth
  ↓
Executor: COMPOSIO_MANAGE_CONNECTIONS (OAuth setup)
  ↓
Executor: COMPOSIO_MULTI_EXECUTE_TOOL (parallel execution)
```

**Benefit:** Single decision path, no branching logic, reduced context usage, faster iteration.

---

### 2. Elimination of Configuration Complexity

**Standard MCP Servers Required:**

- User-scoped URLs per connected account
- authConfigId binding per toolkit
- allowedTools[] whitelist management
- isChatAuth flag configuration
- Per-toolkit connection status tracking
- Manual server selection in mission setup

**Tool Router Requires:**

- Single `COMPOSIO_API_KEY`
- Connection management via `COMPOSIO_MANAGE_CONNECTIONS` meta-tool
- Automatic routing handled internally by Tool Router
- Unified error handling and rate limiting

**Benefit:** Zero manual configuration, self-service OAuth, consistent error messages.

---

### 3. Trust Model Alignment

**Tool Router Meta-Tools Map Cleanly to Trust Stages:**

| Trust Stage            | Tool Router Operation         | Purpose                                                                                |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| **No-Auth Inspection** | `COMPOSIO_SEARCH_TOOLS`       | Semantic toolkit discovery, capability assessment, coverage previews—no OAuth required |
| **Planning**           | `COMPOSIO_CREATE_PLAN`        | Multi-step execution planning with parallelism detection—prepares execution graph      |
| **OAuth Approval**     | `COMPOSIO_MANAGE_CONNECTIONS` | Runtime OAuth handshake after user approval—establishes secure connection              |
| **Governed Execution** | `COMPOSIO_MULTI_EXECUTE_TOOL` | Parallel tool execution with safeguard validation—write actions, sensitive data access |

**Benefit:** Clear separation of concerns, Inspector never touches OAuth, Executor always validates connections before execution.

---

### 4. Operational Simplification

**Monitoring & Debugging:**

**Before (Multiple Mechanisms):**

- Track which MCP server type used per mission
- Separate error codes for standard vs. Tool Router
- Different rate limits per server type
- Fragmented telemetry (per-toolkit + meta-tool events)
- Complex incident runbooks ("which server failed?")

**After (Tool Router Only):**

- Single telemetry event type: `tool_router_call`
- Consistent error codes: `RATE_LIMIT_EXCEEDED`, `OAUTH_EXPIRED`, `TOOLKIT_NOT_FOUND`
- Unified rate limit monitoring across all operations
- Simple runbook: "Tool Router operation failed → check meta-tool, retry with backoff"

**Benefit:** Faster incident resolution, clearer dashboards, reduced on-call complexity.

---

## Tool Router Meta-Tools Reference (Six Total)

**Three-Phase Workflow:**
- **Discovery:** `COMPOSIO_SEARCH_TOOLS`
- **Authentication:** `COMPOSIO_MANAGE_CONNECTIONS` (preview/create/verify); sessions scoped per conversation via `composio.experimental.tool_router.create_session`
- **Execution:** `COMPOSIO_CREATE_PLAN`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`

### 1. `COMPOSIO_SEARCH_TOOLS` (Discovery Phase)

**Purpose:** Semantic toolkit discovery and capability assessment (no OAuth required)

**Used By:** Inspector agent during Prepare stage (and optionally Coordinator in Define stage)

**Parameters:**

```json
{
  "query": "string", // Mission objective or natural language query
  "limit": 10, // Max toolkits to return (default: 10, max: 50)
  "include_metadata": true, // Include action schemas, required scopes, examples
  "filters": {
    // Optional filters
    "categories": ["productivity", "developer"],
    "auth_required": false // Filter for public-only APIs
  }
}
```

**Returns:**

```json
{
  "toolkits": [
    {
      "name": "gmail",
      "description": "...",
      "actions": ["send", "read", "search"],
      "auth_required": true,
      "scopes": ["gmail.send", "gmail.readonly"],
      "coverage_estimate": 0.87,
      "precedent_missions": 142
    }
  ]
}
```

**Caching:** 1-hour TTL recommended to reduce context usage

---

### 2. `COMPOSIO_CREATE_PLAN`

**Purpose:** Multi-step execution planning with parallelism detection

**Used By:** Planner agent during Plan & Approve stage

**Parameters:**

```json
{
  "objective": "string", // High-level mission goal
  "toolkits": ["gmail", "slack"],
  "constraints": {
    "max_parallel": 5,
    "timeout_seconds": 30
  }
}
```

**Returns:**

```json
{
  "plan": {
    "steps": [
      {
        "step_id": 1,
        "toolkit": "gmail",
        "action": "search",
        "params": {...},
        "dependencies": [],
        "parallel_group": 1
      },
      {
        "step_id": 2,
        "toolkit": "slack",
        "action": "post_message",
        "params": {...},
        "dependencies": [1],
        "parallel_group": 2
      }
    ],
    "estimated_duration_seconds": 12
  }
}
```

---

### 3. `COMPOSIO_MANAGE_CONNECTIONS` (Authentication Phase)

**Purpose:** OAuth lifecycle management (create, verify, refresh, delete connections)

**Used By:**
- Inspector agent during Prepare stage (preview mode - does not initiate OAuth)
- Planner agent during Plan & Approve stage (create action - formally initiates OAuth after stakeholder approval)
- Executor agent during Execute & Observe stage (verify action only - checks connection freshness)

**Parameters:**

```json
{
  "action": "preview" | "create" | "verify" | "refresh" | "delete",
  "connection_id": "conn_abc123",  // For verify/refresh/delete
  "toolkit": "gmail",              // For create/preview
  "scopes": ["gmail.send"],        // For create
  "mode": "anticipated",           // For preview (Inspector usage)
  "session_url": "https://...",     // For create (from create_session API)
  "redirect_uri": "https://..."    // Optional fallback if session_url omitted
}
```

**Returns:**

```json
{
  "connection_id": "conn_abc123",
  "status": "active" | "pending" | "expired",
  "authorized_scopes": ["gmail.send", "gmail.readonly"],
  "expires_at": "2025-10-16T14:32:18Z"
}
```

**Auto-Refresh:** Tool Router handles OAuth refresh internally with exponential backoff

---

### 4. Session Management API

**Purpose:** Scope Tool Router access to a single user + conversation and generate presigned MCP URLs.

**API:**

```python
from composio import Composio

composio = Composio()

session = composio.experimental.tool_router.create_session(
    user_id="hey@example.com",
    options={
        "toolkits": ["gmail", "slack"],
        "manuallyManageConnections": False
    }
)

# session = {"session_id": "session_abc123", "url": "https://mcp.composio.dev/..."}
```

**Usage:**
- Planner calls `create_session` after stakeholders approve scopes
- Pass `session["url"]` to `COMPOSIO_MANAGE_CONNECTIONS` (`action="create"`) so Auth Link prompts stay within the approved toolkit set
- Generate a new session per mission conversation; do not store presigned URLs long-term

---

### 5. `COMPOSIO_MULTI_EXECUTE_TOOL` (Execution Phase)

**Purpose:** Parallel tool execution with result aggregation (OAuth-required)

**Used By:** Executor agent during Execute & Observe stage

**Parameters:**

```json
{
  "connection_id": "conn_abc123",
  "actions": [
    {
      "toolkit": "gmail",
      "action": "send",
      "params": {
        "to": "user@example.com",
        "subject": "...",
        "body": "..."
      }
    },
    {
      "toolkit": "slack",
      "action": "post_message",
      "params": {
        "channel": "#general",
        "text": "..."
      }
    }
  ],
  "parallel": true, // Execute concurrently if no dependencies
  "timeout_seconds": 30
}
```

**Returns:**

```json
{
  "results": [
    {
      "action_index": 0,
      "status": "success",
      "result": {...},
      "duration_ms": 1234
    },
    {
      "action_index": 1,
      "status": "error",
      "error_code": "RATE_LIMIT_EXCEEDED",
      "retry_after_seconds": 60
    }
  ],
  "total_duration_ms": 2100
}
```

**Safeguards Integration:** Validator checks all actions before submission, validates results after

---

### 6. `COMPOSIO_REMOTE_WORKBENCH` & `COMPOSIO_REMOTE_BASH_TOOL` (Execution Phase - Advanced)

**Purpose:** Provide isolated compute environments for large-result processing, scripted transforms, and bespoke integrations.

**Used By:** Executor agent when post-processing Tool Router outputs or orchestrating bulk operations that exceed LLM context limits.

**Parameters (Remote Workbench example):**

```json
{
  "connection_id": "conn_abc123",
  "language": "python",
  "code": "# manipulate large result sets\nprocess_artifacts()",
  "timeout_seconds": 240,
  "environment": {
    "PANDAS_VERSION": "2.2.2"
  }
}
```

**Parameters (Remote Bash example):**

```json
{
  "connection_id": "conn_abc123",
  "command": "awk -F, '{print $1}' artifacts/output.csv",
  "working_directory": "/home/user",
  "timeout_seconds": 300
}
```

**Returns (both tools):**

```json
{
  "execution_id": "exec_xyz789",
  "status": "success" | "error" | "timeout",
  "stdout": "...",
  "stderr": "...",
  "artifacts": [
    {
      "filename": "output.json",
      "url": "https://storage.composio.com/artifacts/..."
    }
  ]
}
```

**Use Cases:**
- Multi-step data transformations and enrichment
- Generating CSV/PDF artifacts from tool outputs
- Sanitizing logs before evidence bundling
- Running quick quality checks or regression scripts without leaving the mission workspace

**Security:** Containers are ephemeral, isolated, auto-cleaned, and credentials are injected securely via environment variables.

---

## Implementation Impact

### Inspector Agent Pattern

```python
# agent/agents/inspector.py

async def discover_toolkits(mission_objective: str) -> list[Toolkit]:
    """No-auth toolkit discovery via Tool Router."""

    # Single Tool Router call replaces per-toolkit MCP probing
    response = await tool_router.execute({
        "tool": "COMPOSIO_SEARCH_TOOLS",
        "params": {
            "query": mission_objective,
            "limit": 10,
            "include_metadata": True,
            "filters": {"auth_required": False}  # No-auth inspection only
        }
    })

    # Parse and cache results (1-hour TTL)
    toolkits = [parse_toolkit(tk) for tk in response["toolkits"]]
    await cache.set(f"discovery:{hash(mission_objective)}", toolkits, ttl=3600)

    return toolkits
```

---

### Executor Agent Pattern

```python
# agent/agents/executor.py

async def execute_mission_plan(plan: ExecutionPlan, user_id: str):
    """OAuth-required execution via Tool Router."""

    # 1. Ensure OAuth connection active
    connection = await tool_router.execute({
        "tool": "COMPOSIO_MANAGE_CONNECTIONS",
        "params": {
            "action": "verify",
            "connection_id": plan.connection_id
        }
    })

    if connection["status"] != "active":
        raise OAuthRequiredError("Connection expired, user reauth needed")

    # 2. Validate actions with safeguards before submission
    validated_actions = []
    for action in plan.actions:
        validation = await validator.check(action, plan.safeguards)
        if not validation.passed:
            if validation.auto_fix_available:
                action = validation.apply_fix(action)
            else:
                raise SafeguardViolation(validation.reason)
        validated_actions.append(action)

    # 3. Execute via Tool Router (single call, handles parallelism internally)
    result = await tool_router.execute({
        "tool": "COMPOSIO_MULTI_EXECUTE_TOOL",
        "params": {
            "connection_id": plan.connection_id,
            "actions": [a.to_dict() for a in validated_actions],
            "parallel": True,
            "timeout_seconds": 30
        }
    })

    # 4. Validator post-checks
    for idx, action_result in enumerate(result["results"]):
        await validator.verify_result(action_result, validated_actions[idx])

    return result
```

---

## Migration from Previous Architecture

### What Was Removed

1. **Standard MCP Servers:**
   - Per-toolkit server URLs (Gmail, Slack, GitHub individual servers)
   - Curated bundle configurations (productivity suite, developer tools, sales & marketing)
   - `authConfigId` / `allowedTools[]` / `isChatAuth` configuration logic
   - Server selection decision tree in Coordinator

2. **Composio SDK Direct Usage:**
   - `agent/tools/composio_client.py` replaced with `agent/tools/tool_router_client.py`
   - Direct toolkit discovery API calls replaced with `COMPOSIO_SEARCH_TOOLS`
   - Direct OAuth Connect Link replaced with `COMPOSIO_MANAGE_CONNECTIONS`
   - Direct tool execution replaced with `COMPOSIO_MULTI_EXECUTE_TOOL`

3. **Documentation References:**
   - Removed all mentions of "standard MCP servers" vs. "Tool Router" selection
   - Removed per-toolkit MCP setup instructions
   - Consolidated all integration docs to Tool Router meta-tools only

---

### What Stayed the Same

1. **Trust Model Principles:**
   - No-auth inspection still demonstrates value before OAuth
   - Governed execution still requires explicit user approval
   - Progressive trust flow unchanged: Inspection → Approval → Execution

2. **Safeguards Architecture:**
   - Validator still pre-checks and post-checks all actions
   - Auto-fix logic unchanged
   - Safeguard feedback loops intact

3. **Evidence & Audit Trails:**
   - All tool calls logged (redacted) for compliance
   - Evidence bundles still SHA-256 hashed
   - Undo plans still required for mutating actions

4. **User Experience:**
   - Mission workspace UI unchanged
   - OAuth approval modals still shown at appropriate checkpoints
   - Toolkit recommendation badges still distinguish inspection vs. execution capabilities

---

## Operational Guidelines

### Monitoring Best Practices

**Key Metrics to Track:**

- `tool_router_call` event volume by meta-tool type (SEARCH, PLAN, MANAGE_CONNECTIONS, MULTI_EXECUTE)
- Success rate per meta-tool operation (target: >95%)
- Latency per meta-tool (SEARCH <2s, PLAN <5s, MULTI_EXECUTE <30s)
- Rate limit hit frequency (alert if >100/hour)
- OAuth refresh success rate (target: >98%)
- Token usage per session (Tool Router consumes ~20k tokens/session, alert if >50k)

**Dashboards:**

- Tool Router health (Integration Health Dashboard in docs/07_operations_playbook.md:240)
- Discovery cache hit rate
- Parallel execution efficiency (actions completed concurrently vs. sequentially)

---

### Incident Response

**Tool Router Rate Limit Exceeded:**

1. Check telemetry for `tool_router_call` volume spikes
2. Identify high-volume meta-tool (usually `COMPOSIO_SEARCH_TOOLS`)
3. Verify discovery cache enabled (1-hour TTL)
4. Implement circuit breaker if sustained high load
5. Contact Composio support for quota increase if legitimate usage

**OAuth Connection Failures:**

1. Check `COMPOSIO_MANAGE_CONNECTIONS` verify call results
2. Prompt user to reconnect via UI modal
3. Tool Router handles refresh automatically; if exhausted, surface error
4. Log connection lifecycle events for governance audit

**See Runbook:** docs/07_operations_playbook.md:526 (Runbook 4: Tool Router Rate Limit Exceeded)

---

### Performance Optimization

**Context Usage Management:**

- Tool Router operations consume ~20k tokens/session on average
- Batch discovery queries where possible (single `COMPOSIO_SEARCH_TOOLS` call for related toolkits)
- Cache discovery results aggressively (1-hour TTL standard, extend to 24 hours for stable missions)
- Limit concurrent executions (max 5 parallel actions per `COMPOSIO_MULTI_EXECUTE_TOOL` call)

**Execution Efficiency:**

- Use `COMPOSIO_CREATE_PLAN` to identify parallelizable actions
- Set appropriate timeout values (30s default, 60s for complex integrations)
- Monitor `total_duration_ms` in execution results to identify slow toolkits
- Implement exponential backoff for transient errors (rate limits, network issues)

---

## Documentation Changes Summary

### Files Updated

1. **docs/00_README.md** (Documentation Guide)
   - Updated glossary to specify "Composio Tool Router" as sole interface (docs/00_README.md:193)
   - Revised Partner SDK References to highlight Tool Router meta-tools (docs/00_README.md:221)

2. **docs/01_product_vision.md** (Product Vision)
   - Renamed § 2 to "Tool Router-Driven Orchestration" (docs/01_product_vision.md:170)
   - Updated Strategic Partnerships → Composio section to emphasize Tool Router only (docs/01_product_vision.md:508)

3. **docs/04_implementation_guide.md** (Implementation Guide)
   - Completely rewrote § 5 "Composio Tool Router Integration" (docs/04_implementation_guide.md:131-291)
   - Removed all references to standard MCP servers
   - Added Tool Router implementation patterns with code examples
   - Documented safeguards integration with Tool Router operations

4. **docs/07_operations_playbook.md** (Operations Playbook)
   - Updated Integration Health Dashboard metrics for Tool Router (docs/07_operations_playbook.md:242)
   - Revised Runbook 4 for "Tool Router Rate Limit Exceeded" (docs/07_operations_playbook.md:526)
   - Updated caching strategy to reference Tool Router discovery (docs/07_operations_playbook.md:745)
   - Modified partner contacts to clarify Tool Router support scope (docs/07_operations_playbook.md:823)

5. **docs/09_release_readiness.md** (Release Readiness)
   - Updated partner integration validation checklist to specify Tool Router (docs/09_release_readiness.md:75)

6. **README.md** (Repository Root)
   - Added Tool Router architecture highlight (README.md:11)
   - Replaced Composio SDK client reference with Tool Router client (README.md:112)
   - Updated troubleshooting for Tool Router errors (README.md:122)

7. **AGENTS.md** (AI Agent Quick Reference)
   - Added "Tool Router Architecture" section to Trust Model quick reference (AGENTS.md:13-16)
   - Updated no-auth inspection to reference `COMPOSIO_SEARCH_TOOLS` (AGENTS.md:19)
   - Updated governed execution to reference Tool Router meta-tools (AGENTS.md:25)
   - Replaced "Composio Integration Notes" with "Tool Router Integration Notes" (AGENTS.md:81)

8. **docs/TRUST_MODEL_CLARIFICATION_SUMMARY.md** (This Document)
   - Complete rewrite to position Tool Router as sole mechanism
   - Added rationale for Tool Router-only architecture
   - Documented before/after comparison
   - Provided meta-tool reference specifications
   - Included implementation patterns and operational guidelines

---

## Verification Checklist

- [x] All references to "standard MCP servers" removed
- [x] All references to "per-toolkit MCP servers" removed
- [x] All references to "curated bundles" removed
- [x] Tool Router positioned as "sole interface" in all integration docs
- [x] Inspector agent pattern documented with `COMPOSIO_SEARCH_TOOLS`
- [x] Executor agent pattern documented with `COMPOSIO_MANAGE_CONNECTIONS` + `COMPOSIO_MULTI_EXECUTE_TOOL`
- [x] Safeguards integration with Tool Router operations clarified
- [x] Operations runbook updated for Tool Router-specific incidents
- [x] Monitoring metrics specified for Tool Router meta-tools
- [x] Context usage guidelines documented (~20k tokens/session)
- [x] Cache strategy defined for discovery results (1-hour TTL)
- [x] Error handling patterns documented (rate limits, OAuth refresh)
- [x] Cross-references to `libs_docs/composio/llms.txt` for complete API specs

---

## Key Messages for Stakeholders

### For Product

- **Simplified Positioning:** "One interface for 500+ toolkits" (no explanation of MCP server types needed)
- **User Experience:** No change to mission workspace; OAuth approval flow identical
- **Competitive Differentiation:** Single meta-tool API vs. competitors requiring per-integration setup

### For Engineering

- **Single Integration Point:** All toolkit interactions via six meta-tools (search, plan, manage connections, execute, remote workbench, remote bash)
- **Reduced Complexity:** No branching logic for server selection
- **Clear Patterns:** Inspector uses SEARCH, Executor uses MANAGE_CONNECTIONS + MULTI_EXECUTE
- **Performance:** Monitor token usage (~20k/session), cache discovery (1-hour TTL)

### For Operations

- **Unified Monitoring:** One event type (`tool_router_call`), consistent error codes
- **Simplified Runbooks:** Tool Router rate limit → check cache → implement backoff
- **Partner Escalation:** Single support channel (Composio) for all toolkit issues

### For Governance

- **Trust Model Intact:** No-auth inspection and governed execution separation unchanged
- **Audit Trail:** All Tool Router operations logged with connection_id, toolkit, action
- **Safeguards:** Validator pre/post-checks integrated at `COMPOSIO_MULTI_EXECUTE_TOOL` boundary

---

## Next Steps

### Immediate (This Sprint)

1. ✅ Update all documentation to reflect Tool Router-only architecture with six meta-tools and revised staging
2. ⬜ Verify `agent/tools/tool_router_client.py` implements all six meta-tools (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_CREATE_PLAN`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`)
3. ⬜ Add telemetry event `tool_router_call` with meta-tool type, toolkit, duration, staging context
4. ⬜ Implement discovery cache with 1-hour TTL in Redis
5. ⬜ Update Storybook to show "Anticipated Connections" preview in Prepare stage UI

### Short-Term (Next Sprint)

1. ⬜ Add Tool Router monitoring dashboard (Integration Health in Grafana/Datadog)
2. ⬜ Create runbook template for "Tool Router meta-tool failure" incidents
3. ⬜ Conduct load testing: validate 20k token/session estimate, measure discovery cache hit rate
4. ⬜ Implement circuit breaker for sustained Tool Router rate limits
5. ⬜ Document token usage optimization strategies (batching, caching, parallel execution)

### Medium-Term (This Quarter)

1. ⬜ Create example missions showcasing Tool Router efficiency (one call, multiple toolkits)
2. ⬜ Partner with Composio on case study: "How AI Employee uses Tool Router for 500+ integrations"
3. ⬜ Add Tool Router usage analytics to executive dashboards (meta-tool call volume, success rate)
4. ⬜ Conduct quarterly review: validate Tool Router remains optimal strategy vs. alternatives

---

## References

- **Tool Router API Specs:** `libs_docs/composio/llms.txt` (canonical reference for meta-tool parameters, auth flows, error codes)
- **Architecture Overview:** `docs/02_system_overview.md` (system-wide data flows and layers)
- **Implementation Patterns:** `docs/04_implementation_guide.md` § 5 (Tool Router integration with code examples)
- **Operations Runbooks:** `docs/07_operations_playbook.md` § Runbook 4 (Tool Router rate limit incidents)
- **Monitoring Dashboards:** `docs/07_operations_playbook.md` § Integration Health Dashboard

---

**Document Owner:** Documentation Team + Engineering Leadership
**Contributors:** AI Agent (Claude Code)
**Review Date:** 2025-10-15
**Status:** Final — Ready for stakeholder sign-off
**Approval Required:** Product VP, Engineering VP, Operations Lead
