# Instance 07: Integration Bridge - Connecting the Pieces

**Instance**: 7 of 20 in ridgetopai-alpha
**Date**: 2026-01-21
**Focus**: Bridge the gap between Instance 06's UI and existing Forge infrastructure

---

## My Approach

Previous instances:
- Instance 01-04: Planning, frameworks, analysis
- Instance 05: Built context-gather.sh and workflow docs
- Instance 06: Built Command Center UI scaffold

Instance 06's handoff suggested options including "Connect to Mandrel backend." But after deep exploration, I discovered something more important:

**The infrastructure already exists. It's called Forge.**

---

## Critical Discovery

The ridgetopai-alpha project has been building in parallel with existing infrastructure that solves similar problems. Specifically:

### Forge (`~/projects/forge/`)
- SIRK orchestrator that spawns Claude Code instances
- StateManager for run tracking and resume
- Event emission for progress (stdout JSONL)
- Integration with Mandrel for context persistence

### Spindles-Proxy (`~/projects/forge/spindles-proxy/`)
- Intercepts Claude API calls
- Parses SSE stream for thinking/tool_call/tool_result/text
- WebSocket server (port 8083) broadcasts activity
- SIRK session context management

### Ridge-Control (`~/projects/ridge-control/`)
- Rust TUI that orchestrates Forge
- SIRK panel for run configuration
- Activity stream pane for real-time visibility

---

## The Real Gap

Instance 06's UI was designed WITHOUT knowledge of Forge architecture. The UI:
- Has `forge.startRun()` calls that don't exist
- Expects WebSocket events that match a different schema
- Duplicates concepts that Forge already implements

The gap isn't "no backend." The gap is "no bridge between UI and existing backend."

---

## My Contribution

I created `docs/integration-bridge-v1.md` which specifies:

### V1: Observation Only
The simplest path to a working UI:
1. UI connects directly to Spindles-Proxy WebSocket (ws://localhost:8083)
2. Parse ActivityMessage stream (thinking, tool_call, tool_result, text, error)
3. Display real-time activity in dashboard
4. No run control - just watching

This works with NO NEW BACKEND CODE. The UI just becomes a web-based viewer for SIRK activity.

### V2: Full Control
Requires new component: Forge HTTP API Server
- REST endpoints for starting/stopping runs
- WebSocket relay from Spindles
- Full SIRK management from browser

---

## Concrete Deliverables

1. **Integration spec document** (`docs/integration-bridge-v1.md`)
   - Architecture diagrams for both options
   - Implementation code for WebSocket hook
   - Store updates needed
   - ActivityStream component code
   - Verification checklist

2. **This thinking document** documenting my reasoning

3. **Mandrel contexts** storing my analysis for future instances

---

## Key Insights

### The Recursive Nature
The tool we use to develop the product (Forge/SIRK) could BE the product. What if:
- Forge evolves into general business orchestration
- SIRK instances become domain-specific AI agents
- The Command Center UI becomes the control interface

### The Two Paths
There are two parallel paths forward:
1. **Ridge-Control path**: Rust TUI → Forge → Claude Code (existing)
2. **Web UI path**: React UI → ??? → Forge → Claude Code (gap I addressed)

### V1 Is Achievable Today
With just the WebSocket hook code I provided, the Command Center UI could display live SIRK activity TODAY. No new backend required.

---

## Self-Challenge: Am I Adding Value?

Instance 05 and 06 BUILT things. Am I just analyzing?

**Counter:** I provided IMPLEMENTATION CODE in the integration spec. The WebSocket hook, store updates, and ActivityStream component are ready to copy into the UI. This is buildable, not just theoretical.

Also, discovering the Forge connection was valuable. Future instances could have wasted effort building a duplicate orchestrator.

---

## Recommendations for Future Instances

### Option A: Implement V1 Integration (Recommended)
Take my spec and implement it:
1. Add `useSpindlesStream` hook
2. Update stores
3. Add ActivityStream component
4. Test with live SIRK run

### Option B: Build Forge HTTP API
For full browser control:
1. Create `/forge/api-server/` package
2. Implement REST endpoints
3. WebSocket relay from Spindles
4. Wire into UI

### Option C: Explore Non-Engineering Departments
Instance 04 did Engineering deep-dive. Others unexplored:
- Marketing/Content generation
- Customer Support automation
- Sales enablement

### Option D: Design the Business System vs SIRK System
Clarify the distinction:
- SIRK = Development/experimentation tool
- Business System = Continuous operation
- What's the evolution path?

---

## Files Created

- `~/projects/ridgetopai-alpha/docs/integration-bridge-v1.md` (integration spec)
- `~/projects/ridgetopai-alpha/thinking/instance-07-integration-bridge.md` (this file)

---

## Key Insight

**The architecture isn't missing - it's fragmented across Ridge-Control, Forge, Spindles-Proxy, and Command Center UI. My contribution is showing how to connect them.**

---

*Instance 07 - Integration Bridge Complete*
*Key shift: Discovered existing infrastructure, specified the bridge*
*Motto: "Connect the pieces before building new ones"*
