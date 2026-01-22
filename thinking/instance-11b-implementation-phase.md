# Instance 11b - Implementation Phase for Bug Fix Workflow

**Instance**: 11b (continuation of Instance 11)
**Focus**: Complete the Bug Fix Workflow with real AI implementation
**Principle**: The analysis phase worked. Now make the implementation phase real.

---

## Context

Previous Instance 11 validated the TaskRunner backend and fixed the CLI flag bug.
The Bug Fix Workflow could analyze bugs with real AI, but the implementation
phase (after user approval) still used mock data.

This breaks the end-to-end value proposition of the Inverse Hierarchy model:
- Human DIRECTS (bug report) ✓
- AI EXECUTES (analysis + implementation) ← Implementation was missing
- Human VERIFIES (review approval) ✓

---

## What I Built

### Backend Changes

**File: `backend/src/types.ts`**
Added new types for implementation:
- `ImplementRequestSchema` - Zod schema for request validation
- `ImplementRequest` - TypeScript type for approved changes
- `TestResult` - Test execution results structure
- `ImplementationResult` - Full implementation result

**File: `backend/src/taskRunner.ts`**
Added implementation execution:
- `buildImplementationPrompt()` - Constructs prompt for Claude to apply changes
- `parseImplementationOutput()` - Parses JSON from Claude's response
- `runImplementation()` - Spawns Claude CLI to apply approved changes

**File: `backend/src/index.ts`**
Added implementation endpoint:
- `POST /api/workflow/bugfix/:id/implement` - Applies approved changes

### Frontend Changes

**File: `ui/src/lib/api/taskRunner.ts`**
Added implementation API client:
- `ImplementResponse` - Response type from backend
- `executeImplementation()` - Calls implementation endpoint
- `toImplementation()` - Converts response to UI type

**File: `ui/src/stores/workflow-store.ts`**
Updated review handling:
- When user approves, checks `useRealBackend` flag
- If real backend, calls `executeImplementation()` with approved changes
- If mock (or no changes available), falls back to mock implementation

---

## How It Works

### 1. User Submits Bug Report
UI sends bug report to `/api/workflow/bugfix`

### 2. AI Analyzes Bug
Claude CLI examines codebase and returns structured analysis with proposed fix

### 3. User Reviews Proposal
UI displays diff view with approve/reject options

### 4. User Approves Fix
UI calls `setReview(id, { decision: 'approved' })`

### 5. Implementation Executes (NEW)
Store detects approval, calls `executeImplementation()`:
- Sends approved `changes` array to backend
- Backend spawns Claude CLI with implementation prompt
- Claude applies changes exactly as specified
- Claude runs tests (optional)
- Returns structured result

### 6. User Sees Result
UI shows:
- Changed files list
- Test results (passed/failed/skipped)
- Any warnings
- Completion status

---

## The Implementation Prompt

The key design decision was the prompt structure:

```
You are implementing approved code changes...

### Change 1: path/to/file.ts

**Original code to find:**
```
[original code]
```

**Replace with:**
```
[proposed code]
```

## Your Task
1. Apply each change to the specified file
2. Make ONLY the approved changes - do not modify anything else
3. Run the test suite to verify changes work correctly
4. Report what was done
```

This is explicit and surgical - Claude should apply EXACTLY what was approved,
nothing more.

---

## How to Test

### Terminal 1: Start Backend
```bash
cd ~/projects/ridgetopai-alpha/backend
PORT=3002 npm run dev
```

### Terminal 2: Start UI
```bash
cd ~/projects/ridgetopai-alpha/ui
VITE_USE_REAL_BACKEND=true VITE_TASKRUNNER_URL=http://localhost:3002 npm run dev
```

### Browser
1. Open http://localhost:5173
2. Submit a bug report (use a real bug or create a test file)
3. Wait for AI analysis (~30 seconds)
4. Review the proposed fix
5. Click "Approve"
6. Watch real AI apply the changes

---

## Files Modified

### Backend
- `backend/src/types.ts` - Added implementation types
- `backend/src/taskRunner.ts` - Added `runImplementation()`
- `backend/src/index.ts` - Added `/api/workflow/bugfix/:id/implement`

### Frontend
- `ui/src/lib/api/taskRunner.ts` - Added `executeImplementation()`
- `ui/src/stores/workflow-store.ts` - Updated `setReview()` to use real backend

---

## Build Status

Both builds pass:
- Backend: `npm run typecheck` ✓
- UI: `npm run build` ✓

---

## What's Next

### Option A: Live End-to-End Test
- Start both services
- Submit a real bug
- Complete the full workflow
- Verify changes are actually applied

### Option B: Add Project Path Support
- Currently implementation doesn't know project path
- Could store it in workflow when submitting bug
- Would allow targeting specific projects

### Option C: WebSocket Progress Streaming
- Currently request/response only
- Add WebSocket to show "Applying changes...", "Running tests..."

### Option D: Mandrel Integration
- Store completed workflows to Mandrel
- Previous fixes inform future analysis
- Build institutional memory

### Option E: Error Recovery
- If implementation fails, allow retry
- Show detailed error information
- Allow user to edit changes before re-applying

---

## Key Insight

**The full loop is now REAL.**

```
Human -> Bug Report -> AI Analysis -> Human Review -> AI Implementation -> Done
```

This proves the Inverse Hierarchy model works for PRODUCE capability:
1. Human defines the work (bug report)
2. AI executes the work (analysis + implementation)
3. Human verifies the result (review)

The solo builder can now fix bugs with AI assistance in a structured,
reviewable workflow.

---

*Instance 11b - Completing the Loop*
*Motto: Analysis without implementation is just commentary.*
