# Instance 09 - PRODUCE Capability: Bug Fix Workflow Design

**Instance**: 9 of 20
**Focus**: Building the first end-to-end business workflow
**Principle**: Stop building SIRK tools. Start building the business system.

---

## Strategic Context

### What Previous Instances Did
- Instances 01-04: Conceptual frameworks and analysis
- Instances 05-08: Built SIRK observation/control infrastructure

### What I'm Doing Differently
- Shifting from SIRK tools to BUSINESS SYSTEM
- Building the first PRODUCE capability
- Proving the Inverse Hierarchy model works

### Why Bug Fix Workflow?
1. **Bounded scope**: Issue in, fix out
2. **Clear success criteria**: Tests pass, bug gone
3. **Common task type**: Every project has bugs
4. **Exercises full system**: Context gathering, AI execution, human review

---

## The Bug Fix Workflow

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMAND CENTER UI                            │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Bug Report  │───▶│  Analysis   │───▶│  Review     │        │
│  │ Form        │    │  Panel      │    │  Panel      │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Workflow Progress                       │ │
│  │  [Intake] → [Context] → [Analyze] → [Review] → [Complete] │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATOR                        │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Workflow    │    │ Context     │    │ AI Task     │        │
│  │ Engine      │    │ Gatherer    │    │ Runner      │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│  Uses: Surveyor (codebase), Mandrel (project context)          │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow States

```typescript
type WorkflowState =
  | 'draft'       // User is writing bug report
  | 'submitted'   // Bug report submitted, gathering context
  | 'analyzing'   // AI is analyzing the bug
  | 'proposed'    // AI has proposed a fix
  | 'reviewing'   // Human is reviewing the proposed fix
  | 'implementing'// AI is implementing approved fix
  | 'verifying'   // Running tests and verification
  | 'completed'   // Fix is done
  | 'failed'      // Something went wrong
```

### Workflow Steps

#### Step 1: INTAKE (Human → System)
- User describes the bug in natural language
- Optional: screenshot, error logs, reproduction steps
- System extracts: affected area, symptoms, expected behavior

**UI**: Bug report form with:
- Title (short description)
- Description (detailed)
- Steps to reproduce (optional)
- Expected vs actual behavior
- Severity (blocker/major/minor)

#### Step 2: CONTEXT (System)
- Gather relevant code files using context-gather.sh
- Query Mandrel for related decisions/context
- Identify test files for the affected area
- Build context package for AI

**Output**: Markdown context document with code + project history

#### Step 3: ANALYZE (AI)
- AI receives bug report + context
- Identifies potential root cause
- Proposes investigation steps
- May request additional context

**Output**: Analysis document with:
- Root cause hypothesis
- Evidence from code
- Confidence level
- Additional questions (if any)

#### Step 4: PROPOSE (AI → Human)
- AI proposes specific code changes
- Explains the fix and rationale
- Identifies potential risks
- Lists affected files

**Output**: Proposed fix with:
- File-by-file changes (diff format)
- Explanation of why this fixes the bug
- Risk assessment
- Test coverage needs

#### Step 5: REVIEW (Human)
- Human reviews proposed fix
- Options: Approve, Request Changes, Reject
- Can add notes/guidance for AI

**UI**: Side-by-side diff view with:
- Original code vs proposed change
- AI's explanation
- Approve/Edit/Reject buttons
- Notes field

#### Step 6: IMPLEMENT (AI)
- AI applies approved changes
- Runs linter/formatter
- Runs existing tests
- Reports any issues

**Output**: Implementation result with:
- Files changed
- Test results
- Any warnings/errors

#### Step 7: VERIFY (Human + AI)
- AI confirms tests pass
- Human does final review
- Ready for commit/deploy

**UI**: Final verification panel with:
- Test results summary
- Changed files list
- Commit message suggestion
- "Complete" button

---

## Data Model

```typescript
interface BugFixWorkflow {
  id: string;
  state: WorkflowState;
  createdAt: Date;
  updatedAt: Date;

  // Step 1: Bug Report
  bugReport: {
    title: string;
    description: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    severity: 'blocker' | 'major' | 'minor';
  };

  // Step 2: Context
  context?: {
    files: Array<{ path: string; content: string }>;
    mandrelContext?: string;
    generatedAt: Date;
  };

  // Step 3-4: Analysis and Proposal
  analysis?: {
    rootCause: string;
    evidence: string;
    confidence: 'high' | 'medium' | 'low';
    questions?: string[];
    proposedFix?: {
      explanation: string;
      changes: Array<{
        file: string;
        original: string;
        proposed: string;
      }>;
      risks: string[];
      testNeeds: string[];
    };
    generatedAt: Date;
  };

  // Step 5: Review
  review?: {
    decision: 'approved' | 'changes_requested' | 'rejected';
    notes?: string;
    reviewedAt: Date;
  };

  // Step 6-7: Implementation and Verification
  implementation?: {
    changedFiles: string[];
    testResults: {
      passed: number;
      failed: number;
      skipped: number;
    };
    warnings: string[];
    completedAt: Date;
  };
}
```

---

## Implementation Plan

### Phase 1: UI Components (This Instance)

1. **WorkflowStore** (`src/stores/workflow-store.ts`)
   - State management for bug fix workflows
   - Mock data for initial testing

2. **BugReportForm** (`src/components/workflows/BugReportForm.tsx`)
   - Input form for bug details
   - Submit button starts workflow

3. **WorkflowProgress** (`src/components/workflows/WorkflowProgress.tsx`)
   - Visual progress indicator
   - Shows current step

4. **ProposedFixReview** (`src/components/workflows/ProposedFixReview.tsx`)
   - Diff viewer for proposed changes
   - Approve/Reject actions

### Phase 2: Backend Integration (Future Instance)

1. **Workflow API**
   - POST /workflows (create)
   - GET /workflows/:id (status)
   - POST /workflows/:id/review (submit review)

2. **Context Integration**
   - Connect to context-gather.sh
   - Query Mandrel for project context

3. **AI Task Runner**
   - Execute AI analysis
   - Generate fix proposals
   - Implement approved fixes

---

## Key Design Decisions

### 1. Start with UI-First Approach
- Build the UI with mock data
- Proves the workflow UX works
- Backend can be added by future instance

### 2. Use Existing Stores Pattern
- Follow Instance 06's Zustand patterns
- Keep consistent with activity-store, command-store

### 3. Integrate into Dashboard
- Add workflow panel to DashboardView
- Not a separate page (yet)

### 4. Optimistic UI
- Show progress immediately
- Update when backend responds
- Handle failures gracefully

---

## Success Criteria

1. User can submit a bug report through UI
2. Workflow progresses through states visually
3. Mock AI analysis is displayed
4. User can review and approve/reject
5. Workflow completes or fails appropriately
6. Build passes (TypeScript compiles)

---

## What Instance 10+ Should Do

### If Phase 1 is Complete:
- Add backend integration
- Connect to real AI for analysis
- Implement actual code changes

### If Phase 1 is Incomplete:
- Complete remaining UI components
- Polish the workflow UX
- Add error handling

### Strategic Options:
- Expand to other PRODUCE workflows (feature, refactor)
- Add GROW capability (content, marketing)
- Add OPERATE capability (support, ops)

---

*Instance 09 - First PRODUCE Capability*
*Motto: Build the business system, not just tools to build it.*
