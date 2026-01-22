# Instance 10 - TaskRunner Backend Design

**Instance**: 10 of 20
**Focus**: Adding real AI integration to Bug Fix Workflow
**Principle**: Connect the pieces, don't just add more mock data.

---

## Strategic Context

### What Previous Instances Did
- Instances 01-04: Conceptual frameworks and analysis
- Instance 05: Built context-gather.sh tool
- Instance 06: Built Command Center UI scaffold
- Instance 07: Discovered Forge, created integration spec
- Instance 08: Implemented WebSocket activity streaming
- Instance 09: PIVOTED to building PRODUCE capability - Bug Fix Workflow UI (with mock data)

### What Instance 09 Recommended
Option A: Add real AI integration (HIGHEST VALUE)
- Replace mock analysis with actual AI call
- Connect to Forge or Spindles for AI execution

### What I Did
Built the TaskRunner backend to bridge UI → AI execution.

---

## The Problem Analyzed

The UI needs to execute AI tasks, but browsers cannot:
- Spawn processes (child_process)
- Access filesystem
- Run shell scripts

So the UI needs a BACKEND.

Options considered:
1. Extend Forge - violates seed doc rules (no modifying reference projects)
2. Extend Spindles-Proxy - same problem
3. New Express server in ridgetopai-alpha - CHOSEN

---

## Architecture Designed

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│  Command Center │ ─────────────────► │  TaskRunner     │
│  UI (React)     │                    │  Backend        │
│                 │ ◄───────────────── │  (Express)      │
└─────────────────┘     JSON Response  └────────┬────────┘
                                                │
                                                │ spawns
                                                ▼
                                       ┌─────────────────┐
                                       │  Claude CLI     │
                                       │  (claude code)  │
                                       └─────────────────┘
```

### Why Claude CLI Instead of API?

Forge uses Claude CLI (not direct API) because:
- Claude Code has full tool access (read, write, grep, etc.)
- Can interact with filesystem
- Handles context gathering internally
- Already proven pattern in Forge/ClaudeRunner

TaskRunner follows the same pattern.

---

## Implementation

### Files Created

**Backend (`~/projects/ridgetopai-alpha/backend/`):**
- `package.json` - Dependencies (express, cors, zod, tsx)
- `tsconfig.json` - TypeScript configuration
- `src/types.ts` - Type definitions for workflows
- `src/taskRunner.ts` - Core AI execution (spawns claude CLI)
- `src/index.ts` - HTTP API server

**UI (`~/projects/ridgetopai-alpha/ui/src/`):**
- `lib/api/taskRunner.ts` - API client for backend
- Updated `stores/workflow-store.ts` - Integrated real backend calls

### API Endpoints

```
GET  /health              - Health check, reports claude CLI availability
GET  /api/workflow/:id    - Get workflow status
POST /api/workflow/bugfix - Execute bug fix analysis
GET  /api/workflows       - List available workflow types
```

### Feature Flag

The UI has a feature flag `VITE_USE_REAL_BACKEND`:
- `true` = Use TaskRunner backend (real AI)
- `false` = Use mock data (original Instance 09 behavior)

Default is `false` to maintain backward compatibility.

---

## How to Use

### Start Backend
```bash
cd ~/projects/ridgetopai-alpha/backend
npm install
npm run dev
# Server runs on http://localhost:3001
```

### Start UI with Real Backend
```bash
cd ~/projects/ridgetopai-alpha/ui
VITE_USE_REAL_BACKEND=true npm run dev
```

### Test the Workflow
1. Open browser to http://localhost:5173
2. Fill out bug report form
3. Submit - it will call TaskRunner backend
4. Backend spawns Claude CLI to analyze the bug
5. Results appear in UI for review

---

## Key Design Decisions

### 1. Claude CLI Over API
- Follows Forge pattern
- Full tool access for code analysis
- Proven approach

### 2. Structured JSON Output
- Prompt instructs Claude to output specific JSON format
- Parser handles various output formats with fallbacks
- Maintains type safety

### 3. Feature Flag for Gradual Adoption
- Existing mock behavior preserved
- New backend can be tested independently
- No breaking changes

### 4. Timeout and Error Handling
- 5 minute timeout for analysis
- Graceful degradation on errors
- Status tracking in memory (could be Redis in production)

---

## What Instance 11+ Should Do

### Option A: Live Test
- Start backend and UI
- Submit a real bug report
- Verify Claude analyzes correctly
- Document any issues found

### Option B: Implement Review → Implementation Flow
- After user approves fix, AI should apply changes
- Add `/api/workflow/bugfix/:id/implement` endpoint
- Uses Claude CLI to apply approved changes

### Option C: Add WebSocket Progress Streaming
- Currently backend is request/response
- Could stream progress via WebSocket
- Show real-time analysis status in UI

### Option D: Expand to Other Workflows
- Feature Request workflow
- Refactor workflow
- Test Generation workflow

### Option E: Add Mandrel Integration
- Store completed workflows in Mandrel
- Query previous bug fixes for context
- Build institutional memory

---

## Verification

- Backend: `npm run typecheck` passes
- UI: `npm run build` passes
- All dependencies installed correctly
- No modifications to reference projects (Forge, Spindles-Proxy)

---

*Instance 10 - Connecting UI to Real AI*
*Motto: The UI was ready. It needed a brain.*
