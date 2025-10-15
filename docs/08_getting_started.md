# AI Employee Control Plane: Getting Started

**Version:** 3.0 (October 2025)
**Audience:** New developers, operators, and stakeholders
**Purpose:** Set up environment, run the stack, complete your first mission
**Status:** Active onboarding guide

---

## Overview

This guide walks you through:

1. **Environment Setup** — Install tools, configure secrets, verify dependencies
2. **Running the Stack** — Start local development environment (UI + Agent + Supabase)
3. **First Mission Walkthrough** — Experience the five-stage mission journey hands-on
4. **Troubleshooting** — Common issues and solutions
5. **Next Steps** — Where to go after initial setup

**Time Required:** 30-45 minutes for complete setup and first mission

---

## Prerequisites

### System Requirements

- **Operating System:** macOS, Linux, or WSL2 on Windows
- **RAM:** Minimum 8GB, recommended 16GB
- **Disk Space:** 5GB free for dependencies and local database
- **Network:** Internet access for package downloads and API calls

### Accounts & API Keys

You'll need:

1. **Supabase Project** (free tier works)
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Composio API Key** (optional for full toolkit features)
   - Sign up at [composio.dev](https://composio.dev)
   - Generate API key from dashboard

3. **Google AI API Key** (for Gemini models)
   - Get key from [aistudio.google.com](https://aistudio.google.com)

4. **OpenAI API Key** (optional fallback)
   - Get key from [platform.openai.com](https://platform.openai.com)

**Note:** For initial exploration, you can start with just Supabase and Google AI keys.

---

## Environment Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd ai_employee_control_plane
```

### Step 2: Install mise (Toolchain Manager)

mise manages tool versions, environment variables, and project tasks for this repo.

**macOS/Linux:**

```bash
curl https://mise.run | sh
```

**Or via package manager:**

```bash
# macOS
brew install mise

# Linux
curl https://mise.jdx.dev/install.sh | sh
```

**Verify installation:**

```bash
mise --version
```

### Step 3: Trust and Install Tools

From the repository root:

```bash
# Trust the mise configuration
mise trust

# Install all required tools (Node, Python, pnpm, uv)
mise install

# Verify installed versions
mise current
```

**Expected output:**

```
node     22.20.0
python   3.13.7
pnpm     10.18.0
uv       0.9.2
```

### Step 4: Install Dependencies

```bash
# Install frontend dependencies
mise run install

# Install agent dependencies
mise run agent-deps
```

### Step 5: Configure Environment Secrets

Create a `.env` file in the repository root:

```bash
cp .env.example .env  # If example exists, otherwise create new file
```

Edit `.env` and add your credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Composio (optional for full features)
COMPOSIO_API_KEY=your-composio-key

# AI Models
GOOGLE_API_KEY=your-google-ai-key
OPENAI_API_KEY=your-openai-key  # Optional

# Encryption (generate random string)
ENCRYPTION_KEY=$(openssl rand -hex 32)

```

**Security Note:** Never commit `.env` to version control. It's already in `.gitignore`.

### Step 6: Set Up Supabase Database

If using Supabase local development:

```bash
# Install Supabase CLI if not already installed
mise exec -- npm install -g supabase

# Start local Supabase
supabase start

# Apply migrations
supabase db reset --seed supabase/seed.sql
```

If using Supabase cloud project:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Seed data (optional)
supabase db execute --file supabase/seed.sql
```

### Step 7: Generate TypeScript Types

```bash
# For linked cloud project
supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts

# Verify types compile
pnpm tsc --noEmit
```

---

## Running the Stack

### Quick Start (All Services)

```bash
# Start Next.js UI + FastAPI Agent concurrently
mise run dev
```

This command starts:

- **Next.js dev server** at `http://localhost:3000`
- **FastAPI agent server** at `http://localhost:8000`

**Expected output:**

```
✓ Ready in 2.3s
➜  Local:   http://localhost:3000
➜  Network: http://192.168.1.x:3000

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

### Running Services Individually

**UI Only:**

```bash
mise run ui
# or
pnpm dev
```

**Agent Only:**

```bash
mise run agent
# or
./scripts/run-agent.sh
```

**Supabase Only:**

```bash
supabase start
```

### Verify Services

1. **Frontend:** Open `http://localhost:3000` — should see control plane UI
2. **Agent:** Visit `http://localhost:8000/docs` — should see FastAPI docs
3. **Supabase:** Check `supabase status` — should show running services

---

## First Mission Walkthrough

Now that your environment is running, let's complete a mission end-to-end.

### Mission Scenario: Revenue Expansion Outreach

**Objective:** Draft personalized outreach to dormant accounts

**Time Required:** 10-15 minutes

---

### Stage 1: Define

1. **Navigate** to the mission workspace at `http://localhost:3000`

2. **Paste objective** in the generative intake banner:

```
Revive our top 20 dormant accounts from Q2 with personalized outreach.
Focus on accounts with >$50K prior ARR. Tone should be warm and
consultative, not salesy. Send between 9am-5pm EST, Tuesday-Thursday only.
```

3. **Watch chips generate** — The system produces:
   - **Objective:** "Revive dormant high-value accounts"
   - **Audience:** "Accounts >$50K ARR, dormant Q2"
   - **KPIs:** "Reply rate ≥3%, meeting bookings ≥5"
   - **Safeguards:** "Warm tone, send window 9-5 EST Tue-Thu"
   - **Timeline:** "Complete within 3 business days"

4. **Edit any chip** — Click to edit inline if needed:
   - Try regenerating the "KPIs" chip
   - Notice confidence badges (High/Medium/Needs Review)

5. **Accept chips** — Click "Accept All" or `Ctrl+Enter`

**Expected Result:** Mission brief locks and stage 2 activates

---

### Stage 2: Prepare

1. **Review pinned brief** — See accepted chips displayed in brief card

2. **Edit option** — Notice "Edit Brief" button (returns to stage 1 if needed)

**Expected Result:** Brief is locked, toolkit discovery begins

---

### Stage 3: Plan & Approve

1. **View recommendations** — System suggests toolkits:
   - **HubSpot** (no-auth) — Contact enrichment
   - **Gmail** (OAuth required) — Email sending
   - **Slack** (OAuth optional) — Team notifications

2. **Select toolkits** — Multi-select recommended toolkits:
   - ☑ HubSpot (no-auth)
   - ☐ Gmail (skip OAuth during inspection)

3. **Review auth badges** — Notice:
   - 🟢 No-auth ready
   - 🟡 OAuth-ready (optional during inspection)

**Expected Result:** Toolkit selections persist, inspection begins

---

### Stage 4: Execute & Observe

1. **Watch coverage meter** — System validates:
   - ✓ Objectives (100%)
   - ✓ Contacts (HubSpot preview fetched)
   - ✓ Safeguards (tone, timing validated)
   - ✓ Automation readiness (85%+)

2. **Review findings** — Inspection summary shows:
   - 87 contacts match criteria
   - Safeguard coverage: complete
   - Recommendation: Proceed to planning

**Expected Result:** Coverage ≥85%, planning stage unlocked

---

### Stage 5: Reflect & Improve

1. **Watch planner stream** — Agent generates 3 candidate plays:
   - **Play 1:** "Targeted Q2 Win-Back Campaign"
     - Rationale: "Similar to 5 successful missions in library"
     - Tools: HubSpot enrichment + draft emails
     - Success projection: 3-5% reply rate

2. **Select a play** — Click "Select Play 1"

3. **Review safeguards** — Validator confirms:
   - ✓ Tone: Warm, consultative
   - ✓ Timing: 9am-5pm EST, Tue-Thu only
   - ✓ Escalation: Review before send

**Expected Result:** Play selected, ready for governed execution

---

### Stage 6: Governed Execution

1. **Start execution** — Click "Run Execution"

2. **Watch streaming status panel** — See progress:

   ```
   [Step 1/4] Enriching contacts from HubSpot... ✓ (87 contacts)
   [Step 2/4] Generating personalized email drafts... ⏳
   [Step 3/4] Applying tone safeguards...
   [Step 4/4] Packaging evidence bundle...
   ```

3. **Review validation checkpoints** — Notice:
   - Auto-fix applied: "Softened 3 email openers for warmth"
   - No violations detected

4. **Wait for completion** — Typically 2-5 minutes for a governed run

**Expected Result:** Execute & Observe complete, evidence bundle generated

---

### Reflect & Improve Highlights

1. **View artifact gallery** — Artifacts displayed:
   - 📄 **Contact List** (87 enriched records)
   - 📧 **Email Drafts** (87 personalized messages)
   - 📊 **ROI Estimate** (3-5% reply rate, 4-7 meetings projected)

2. **Inspect artifacts** — Click to preview:
   - See sample email drafts
   - Review tone and personalization quality
   - Check hash badges (SHA-256 verification)

3. **Review undo bar** — See rollback plan:
   - "Undo available for 15 minutes after activation"
   - Impact summary: "Mutations tracked with undo plan"

4. **Export evidence** — Download bundle:
   - PDF for stakeholder review
   - CSV for data analysis

**Expected Result:** Evidence validated, ready for governed execution or feedback

---

### Stage 5: Reflect & Improve

1. **Open feedback drawer** — Click feedback icon
2. **Submit feedback** — Provide quick reaction:
   - ⭐⭐⭐⭐⭐ Satisfaction: 5/5
   - ⏱️ Effort saved: "3 hours of manual work"
   - 💡 Note: "Love the tone safeguard auto-fix!"
3. **Pin to library** (optional) — Tag this play for reuse:
   - Add tags: `revenue`, `win-back`, `q2-dormant`
   - Make available to team

**Expected Result:** Mission complete, feedback captured, library updated

---

## Next Steps After First Mission

### Governed Execution (OAuth Flow)

To send real emails:

1. Return to **Stage 2: Prepare**
2. Select Gmail toolkit
3. Click "Connect via OAuth"
4. Authorize scopes in Connect Link
5. Proceed through stages again
6. In **Stage 4**, enable OAuth and proceed with governed execution when ready

### Explore More Use Cases

Try these mission templates:

- **Support Triage:** Categorize and draft responses for Zendesk tickets
- **Data Research:** Competitive analysis using web search and enrichment
- **Operations Automation:** Schedule meetings or send billing reminders

### Dive Deeper into Documentation

- **[User Experience Blueprint](./03_user_experience.md)** — Understand all eight stages in detail
- **[System Overview](./02_system_overview.md)** — Learn architecture and data flows
- **[Implementation Guide](./04_implementation_guide.md)** — Extend with custom components or agents

### Contribute to the Project

- Review [AGENTS.md](../AGENTS.md) for AI agent workflows
- Check [Capability Roadmap](./05_capability_roadmap.md) for upcoming features
- Submit feedback or issues via project channels

---

## Troubleshooting

### Common Issues

#### Issue: `mise: command not found`

**Solution:**

```bash
# Add mise to PATH
echo 'eval "$(mise activate bash)"' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc
```

#### Issue: `Module not found` errors in Next.js

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules .next
pnpm install
```

#### Issue: Agent server fails to start

**Solution:**

```bash
# Check Python environment
mise run agent-deps

# Verify .env has required keys
grep -E 'GOOGLE_API_KEY|SUPABASE' .env

# Check logs
mise run agent
```

#### Issue: Supabase connection errors

**Solution:**

```bash
# Verify Supabase is running
supabase status

# Check migrations applied
supabase db diff

# Regenerate types
supabase gen types typescript --linked > supabase/types.ts
```

#### Issue: Chips not generating during intake

**Solution:**

- Verify `GOOGLE_API_KEY` in `.env`
- Check browser console for errors
- Ensure agent server is running at `:8000`
- Try with simpler objective text first

#### Issue: Rate limit errors from APIs

**Solution:**

- Check API key quotas (Google AI, Composio)
- Use inspection mode to avoid external calls
- Verify Supabase rate limiting functions deployed

### Debug Commands

```bash
# Check tool versions
mise current

# Verify environment variables
mise env

# Check which tools are active
mise which node
mise which python

# Run health check
mise doctor

# View all available tasks
mise tasks

# Tail logs
tail -f logs/agent.log  # if logging configured
```

### Getting Help

- **Internal:** Slack `#ai-control-plane` or `@ai-agent-team`
- **Documentation:** See [00_README.md](./00_README.md) for navigation
- **AGENTS.md:** Quick troubleshooting cheatsheet in [AGENTS.md](../AGENTS.md)
- **Runbooks:** Check `docs/readiness/runbooks/` for specific scenarios

---

## Environment Verification Checklist

Before proceeding to development, verify:

- [ ] mise installed and active (`mise --version`)
- [ ] All tools installed (`mise current` shows expected versions)
- [ ] Dependencies installed (`node_modules/` and `agent/.venv/` exist)
- [ ] `.env` configured with required keys
- [ ] Supabase running and migrations applied
- [ ] TypeScript types generated (`supabase/types.ts` exists)
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] Agent accessible at `http://localhost:8000/docs`
- [ ] First mission completed successfully

---

## Quick Reference Commands

```bash
# Start full stack
mise run dev

# Start UI only
mise run ui

# Start agent only
mise run agent

# Run tests
pnpm test:ui           # Frontend tests
mise run test-agent    # Agent evals
pnpm run lint          # Linting

# Supabase
supabase start         # Start local instance
supabase status        # Check status
supabase db reset      # Reset and seed

# Generate types
supabase gen types typescript --linked > supabase/types.ts

# View logs
tail -f .next/server/*.log  # Next.js logs (if available)
```

---

## Additional Resources

### Documentation

- [00_README.md](./00_README.md) — Documentation navigation
- [AGENTS.md](../AGENTS.md) — AI agent quick reference
- [01_product_vision.md](./01_product_vision.md) — Product context
- [02_system_overview.md](./02_system_overview.md) — Architecture
- [04_implementation_guide.md](./04_implementation_guide.md) — Development guide

### Partner Documentation

- [CopilotKit](../libs_docs/copilotkit/llms-full.txt) — UI integration
- [Composio](../libs_docs/composio/llms.txt) — Toolkit platform
- [Gemini ADK](../libs_docs/adk/llms-full.txt) — Agent framework
- [Supabase](../libs_docs/supabase/llms_docs.txt) — Database & storage

### Example Files

- `examples/mission_example_revenue.json` — Revenue mission template
- `examples/mission_example_support.json` — Support mission template
- `examples/telemetry_sample_traces.json` — Event payload examples

---

**Document Owner:** Engineering & Product Teams
**Last Updated:** October 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
