# Instance 12: GROW Capability - Content Generation Workflow

**Instance**: 12 of 20 in ridgetopai-alpha
**Date**: 2026-01-21
**Focus**: First GROW capability - horizontal slice approach

---

## Strategic Decision: The Horizontal Slice Approach

### The Insight

Instead of completing PRODUCE entirely before starting GROW, I proposed building **horizontal slices across capabilities**.

A horizontal slice is: One workflow per capability that demonstrates the Inverse Hierarchy pattern.

Before Instance 12:
- PRODUCE: Bug Fix Workflow (complete end-to-end)
- GROW: Nothing
- OPERATE: Nothing

After Instance 12:
- PRODUCE: Bug Fix Workflow (unchanged)
- GROW: Content Generation Workflow (new)
- OPERATE: Still needed

### Why This Approach

1. **Demonstrates the Full Vision**: Three workflows across three capabilities proves the model generalizes beyond engineering.

2. **Reveals Integration Challenges Early**: Cross-capability coherence requires workflows to interact. Can't test integration with only one capability.

3. **Enables Parallel Future Work**: Once all three have one workflow, future instances can deepen any capability based on actual needs.

4. **Matches the Economics**: To get first customer, Brian needs:
   - Product that works (PRODUCE - have it)
   - Way to find customers (GROW - need it)
   - Way to support them (OPERATE - need it)

---

## What I Built

### Backend (~/projects/ridgetopai-alpha/backend/)

**New Files:**
- `src/contentRunner.ts` - Claude CLI executor for content generation
- Types added to `src/types.ts` for content workflows

**Updated Files:**
- `src/index.ts` - Added content generation API endpoints:
  - `GET /api/workflow/content/:id` - Get workflow status
  - `POST /api/workflow/content` - Generate content
  - `POST /api/workflow/content/:id/refine` - Refine content based on feedback

### Frontend (~/projects/ridgetopai-alpha/ui/)

**New Files:**
- `src/lib/types/content-workflow.ts` - TypeScript types for content workflows
- `src/lib/api/contentRunner.ts` - API client for content backend
- `src/stores/content-workflow-store.ts` - Zustand store for content state
- `src/components/content-workflows/ContentPanel.tsx` - Main panel
- `src/components/content-workflows/ContentBriefForm.tsx` - Brief input form
- `src/components/content-workflows/ContentProgress.tsx` - Progress indicator
- `src/components/content-workflows/ContentReview.tsx` - Review component
- `src/components/content-workflows/index.ts` - Exports

**Updated Files:**
- `src/lib/types/index.ts` - Added content-workflow exports
- `src/components/dashboard/DashboardView.tsx` - Added ContentPanel alongside BugFixPanel

---

## The Content Generation Workflow

### Workflow States

```
draft -> submitted -> researching -> generating -> proposed -> reviewing -> refining -> completed
                                                                                 |
                                                                              failed
```

### Inverse Hierarchy in Action

1. **Human directs**: Creates content brief (title, topic, format, audience, tone, key points)
2. **AI executes**: Generates content matching specifications
3. **Human verifies**: Reviews, approves, or requests revisions
4. **AI refines**: Applies feedback if needed
5. **Output**: Ready-to-publish content

### Content Formats Supported

- Blog Post
- Tweet Thread
- Documentation
- Email
- Announcement
- Case Study

### Audience Options

- Developers
- Business
- General Public
- Internal Team

### Tone Options

- Professional
- Conversational
- Technical
- Educational

---

## Architecture Patterns Followed

### Same as Bug Fix Workflow

1. **Types file** defines the domain model
2. **API client** wraps fetch calls
3. **Zustand store** manages state with mock fallback
4. **Feature flag** (`VITE_USE_REAL_BACKEND`) controls mock vs real
5. **CLI spawning** via Claude for AI execution
6. **JSON parsing** of structured AI output

### What This Proves

The workflow architecture established by Instances 9-11b is **generalizable**. The same patterns work for:
- PRODUCE (Bug Fix): Code analysis, human review, code implementation
- GROW (Content): Content generation, human review, refinement

This validates that OPERATE workflows (Support Ticket) can follow the same pattern.

---

## Testing Instructions

### Mock Mode (no backend needed)

```bash
cd ~/projects/ridgetopai-alpha/ui
npm run dev
# Open http://localhost:5173
# Content Panel shows on right side of dashboard
```

### Real Mode (with backend)

```bash
# Terminal 1: Start backend
cd ~/projects/ridgetopai-alpha/backend
PORT=3002 npm run dev

# Terminal 2: Start UI with real backend
cd ~/projects/ridgetopai-alpha/ui
VITE_USE_REAL_BACKEND=true VITE_TASKRUNNER_URL=http://localhost:3002 npm run dev

# Browser: http://localhost:5173
```

### Content Generation Flow

1. In ContentPanel, fill out brief:
   - Title (required)
   - Topic (required)
   - Format (dropdown)
   - Audience (dropdown)
   - Tone (dropdown)
   - Key points (optional tags)
   - Keywords (optional tags)
   - Word count (optional)

2. Click "Generate Content"

3. Watch progress: Researching -> Generating -> Proposed

4. Review generated content:
   - See confidence level
   - Read content preview
   - View AI suggestions
   - See alternatives

5. Decision:
   - **Approve**: Content finalized
   - **Request Changes**: Enter feedback, submit for refinement
   - **Reject**: Workflow fails

6. If approved, copy to clipboard

---

## Build Status

Both builds pass:
- Backend: `npm run typecheck` - success
- UI: `npm run build` - success (407KB JS, 37KB CSS)

---

## Recommended Next Steps

### Option A: OPERATE Capability (Priority)
Build Support Ticket Workflow to complete the horizontal slice:
- Human submits ticket (issue description, urgency)
- AI analyzes (categorize, search knowledge, propose response)
- Human reviews (approve, edit, escalate)
- AI executes (send response, update records)

### Option B: Mandrel Integration
Store completed workflows to Mandrel:
- Build institutional memory
- Learn from previous content/fixes
- Enable cross-workflow intelligence

### Option C: Live Testing
End-to-end test both workflows with real AI:
- Submit actual bug
- Generate actual content for RidgeTop AI
- Verify quality and usefulness

### Option D: Cross-Capability Integration
Start connecting workflows:
- Feature shipped -> Auto-generate announcement (PRODUCE -> GROW)
- Support ticket reveals bug -> Create bug fix (OPERATE -> PRODUCE)

### Option E: Polish UI
- Better markdown rendering in content preview
- Export to file functionality
- Side-by-side diff for refinements

---

## Key Insight

**The business system is not about depth in one capability. It's about breadth across all capabilities with the same quality bar.**

A solo builder competing with a mid-sized company needs:
- PRODUCE: Working software (Bug Fix proves this)
- GROW: Content and marketing (Content Gen proves this)
- OPERATE: Customer support (Still needed)

One workflow in each capability that works end-to-end is more valuable than 10 workflows in just engineering.

---

*Instance 12 - GROW Capability Complete*
*Stored for SIRK continuation*
