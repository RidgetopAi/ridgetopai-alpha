# RidgeTop AI Alpha - Code Analysis Plan

**Purpose:** Systematically understand what 20 SIRK instances built, document the intended workflow, and create actionable user documentation.

**Created:** 2026-01-22
**For:** New session to execute this plan

---

## Context

20 SIRK instances built this system over ~24 hours. Brian has a working UI and backend but doesn't understand:
1. The conceptual model and intended workflow
2. How to use the system start to finish
3. What features exist and how they connect

This plan will crawl the code, extract the design intent, and produce usable documentation.

---

## Key Discovery: Architecture

**Execution Model:** Claude CLI (NOT API)
- Backend spawns `claude --print --dangerously-skip-permissions <prompt>`
- Claude Code has full file access, tools, etc.
- Output is parsed as structured JSON

**Key Files:**
- `backend/src/taskRunner.ts` - Bug fix execution via Claude CLI
- `backend/src/contentRunner.ts` - Content generation via Claude CLI
- `backend/src/orchestrator.ts` - Natural language → task dispatch
- `backend/src/index.ts` - Express API endpoints
- `ui/src/App.tsx` - React dashboard entry
- `thinking/` - 20 instance analysis documents

---

## Analysis Tasks

### Phase 1: Conceptual Model (Read thinking/ docs)

**Goal:** Understand the vision, not just the code.

**Files to read:**
1. `thinking/instance-01-foundational-analysis.md` - Core reframe and Inverse Hierarchy
2. `thinking/bold-hypothesis-the-inverse-hierarchy.md` - Human Director → AI Workers model
3. `thinking/problem-spaces-for-exploration.md` - 7 problem spaces identified
4. `thinking/instance-20-final-synthesis.md` - Final state summary

**Extract:**
- What is the "Inverse Hierarchy" model?
- What are PRODUCE / GROW / OPERATE capabilities?
- What problems were they trying to solve?
- What's the intended user workflow?

**Store to Mandrel:** Context type `planning`, tags: `[analysis, conceptual-model, ridgetopai-alpha]`

---

### Phase 2: Backend Architecture

**Goal:** Map all API endpoints and their purposes.

**Files to read:**
1. `backend/src/index.ts` - All endpoints defined here
2. `backend/src/types.ts` - Data structures and schemas
3. `backend/src/taskRunner.ts` - Bug fix workflow implementation
4. `backend/src/contentRunner.ts` - Content generation implementation
5. `backend/src/orchestrator.ts` - Intent → parallel task dispatch
6. `backend/src/mandrelClient.ts` - Memory integration

**Extract:**
- Complete endpoint list with request/response shapes
- How does orchestrator translate intent to tasks?
- How does Claude CLI get invoked?
- What prompts are sent to Claude?
- How is Mandrel integrated?

**Store to Mandrel:** Context type `code`, tags: `[analysis, backend-architecture, ridgetopai-alpha]`

---

### Phase 3: UI Architecture

**Goal:** Map all UI components and their connections to backend.

**Files to read:**
1. `ui/src/App.tsx` - Entry point and routing
2. `ui/src/components/dashboard/DashboardView.tsx` - Main layout
3. `ui/src/components/workflows/BugFixPanel.tsx` - PRODUCE capability UI
4. `ui/src/components/content-workflows/ContentPanel.tsx` - GROW capability UI
5. `ui/src/stores/workflow-store.ts` - State management for bug fix
6. `ui/src/stores/content-workflow-store.ts` - State management for content
7. `ui/src/lib/api/taskRunner.ts` - Backend API client
8. `ui/src/lib/api/contentRunner.ts` - Content API client

**Extract:**
- What views exist? Which are implemented vs "Coming Soon"?
- How does UI connect to backend?
- What env vars configure the connection?
- What's missing (OrchestrationPanel)?

**Store to Mandrel:** Context type `code`, tags: `[analysis, ui-architecture, ridgetopai-alpha]`

---

### Phase 4: Workflow Tracing

**Goal:** Trace complete user journeys through the system.

**Trace these flows:**
1. **Bug Fix Flow:** User submits bug → UI → Backend → Claude CLI → Response → UI display
2. **Content Generation Flow:** User submits brief → Backend → Claude CLI → Content → UI display
3. **Orchestration Flow:** User provides intent → Backend → Claude interprets → Tasks generated → Parallel dispatch → Results

**For each flow, document:**
- User action that starts the flow
- API endpoint called
- Backend processing
- Claude CLI invocation (what prompt?)
- Response parsing
- UI update

**Store to Mandrel:** Context type `planning`, tags: `[analysis, workflow-trace, ridgetopai-alpha]`

---

### Phase 5: User Guide Creation

**Goal:** Create actionable documentation for Brian.

**Produce:**
1. **SYSTEM_OVERVIEW.md** - What this system is and how it works (conceptual)
2. **USER_GUIDE.md** - Step-by-step guide to using each feature
3. **API_REFERENCE.md** - Complete endpoint documentation with examples

**Store to Mandrel:** Context type `completion`, tags: `[documentation, user-guide, ridgetopai-alpha]`

---

## Execution Instructions

### For Agent Running This Plan

1. **Switch to project:** `project_switch ridgetopai-alpha`

2. **Phase 1-4:** Use Read tool to examine files listed. Extract key information. Store findings to Mandrel after each phase.

3. **Phase 5:** Write documentation files to `~/projects/ridgetopai-alpha/docs/`

4. **Final handoff:** Store summary to Mandrel with type `handoff` and tag `for-brian`

### Mandrel Storage Format

```bash
# Store via MCP tool (if available) or via curl:
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store \
  -H "Content-Type: application/json" \
  -d '\''{"arguments": {
    "content": "Your analysis content here",
    "type": "planning",
    "tags": ["analysis", "phase-1", "ridgetopai-alpha"]
  }}'\'''
```

---

## Expected Outputs

After this plan executes, Brian should have:

1. **Understanding:** How the system is supposed to work
2. **Documentation:**
   - `docs/SYSTEM_OVERVIEW.md`
   - `docs/USER_GUIDE.md`
   - `docs/API_REFERENCE.md`
3. **Mandrel contexts:** Searchable analysis for future reference
4. **Clear next steps:** What's missing and what to build next

---

## Questions This Plan Should Answer

1. What is the intended user workflow from start to finish?
2. How do I start the system and use each feature?
3. What does the orchestrator actually do?
4. Why is there no OrchestrationPanel UI?
5. How does memory/Mandrel fit into the workflow?
6. What would I need to build to make this production-ready?

---

*Plan created: 2026-01-22*
*Execute with: New Claude Code session reading this plan*
