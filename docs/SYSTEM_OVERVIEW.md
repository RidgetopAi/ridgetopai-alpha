# RidgeTop AI Alpha - System Overview

## What Is This System?

RidgeTop AI Alpha is an **AI-powered company orchestration system** for a solo builder. It implements the **Inverse Hierarchy** model where AI does the execution and humans provide direction, judgment, and relationship management.

Instead of a traditional organization with 200 employees, this system enables one person to achieve similar business output through intelligent AI coordination.

---

## The Inverse Hierarchy Model

### Traditional Company Structure
```
CEO
  ↓
Managers (planning, coordination)
  ↓
Workers (execution)
  ↓
Output
```

### RidgeTop AI Structure
```
Human Director (Brian)
  ↓
AI Orchestrator (intent → tasks)
  ↓
AI Workers (execution via Claude CLI)
  ↓
Output → Mandrel (institutional memory)
```

**Key Insight**: The human moves from executor to **quality controller and decision maker**. AI handles routine execution; humans handle judgment, relationships, and direction.

---

## The Three Capabilities

### PRODUCE (Build Things)
**Purpose**: Engineering, bug fixes, feature implementation

**What it does**:
- Accepts bug reports with title, description, severity
- AI analyzes codebase to find root cause
- Proposes specific code changes with explanations
- Human reviews and approves/rejects
- AI implements approved changes and runs tests

**Example**: "Login button not working" → AI finds the bug in `auth.ts:142`, proposes fix, you approve, it's implemented.

### GROW (Attract Customers)
**Purpose**: Content generation, marketing materials

**What it does**:
- Accepts content briefs (topic, format, audience, tone)
- AI generates complete, publish-ready content
- Human reviews and requests refinements
- AI refines based on feedback
- Final content ready for use

**Formats supported**: Blog posts, tweet threads, documentation, emails, announcements, case studies

### OPERATE (Keep Things Running)
**Purpose**: Support tickets, monitoring, customer communication

**Status**: Not yet implemented. The framework exists; the workflows don't.

---

## How It Actually Works

### Execution Model
The backend spawns Claude CLI for each task:
```bash
claude --print --dangerously-skip-permissions "<prompt>"
```

This gives Claude full access to:
- File system (read/write code)
- Terminal commands (run tests, builds)
- All Claude Code tools

The output is captured as structured JSON and returned to the UI.

### Memory Integration (Mandrel)
Completed workflows are stored to Mandrel for institutional memory:
- Previous bug fixes inform new analyses
- Content history maintains brand consistency
- Decisions and context persist across sessions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER (Brian)                           │
│   Direction / Review / Approval / Relationships                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         REACT UI                                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │ BugFixPanel  │  │ ContentPanel │  │ OrchestrationPanel   │ │
│   │  (PRODUCE)   │  │   (GROW)     │  │    (NOT BUILT)       │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                 │
│   Zustand Stores: workflow-store, content-workflow-store        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │ taskRunner   │  │contentRunner │  │    orchestrator      │ │
│   │  (bug fix)   │  │  (content)   │  │ (intent → tasks)     │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                              ↓                                  │
│                     mandrelClient (memory)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ spawn
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE CLI                               │
│   Full tool access, file operations, terminal, etc.             │
│   Returns structured JSON output                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         MANDREL                                 │
│   Institutional memory (contexts, decisions, completions)       │
│   https://mandrel.ridgetopai.net                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## What's Built vs What's Missing

### Built and Working
| Component | Status | Notes |
|-----------|--------|-------|
| Backend server | ✅ | Express.js, TypeScript |
| Bug fix workflow | ✅ | Full analysis + implementation |
| Content generation | ✅ | Full generation + refinement |
| Orchestrator | ✅ | Intent → task generation + dispatch |
| Mandrel integration | ✅ | Context storage and retrieval |
| React UI | ✅ | Dashboard with BugFixPanel, ContentPanel |
| Build system | ✅ | Both backend and UI build cleanly |

### Missing / Incomplete
| Component | Status | Notes |
|-----------|--------|-------|
| OrchestrationPanel UI | ❌ | Backend works, no UI |
| OPERATE workflows | ❌ | Support, monitoring not built |
| Queue/Workflow/Context/History views | ❌ | "Coming Soon" placeholders |
| Session persistence | ❌ | Orchestration sessions are in-memory |
| Automation | ❌ | All workflows require manual trigger |

---

## Key Questions Answered

### 1. What is the Inverse Hierarchy?
AI executes, humans direct. The human doesn't do the work—they set direction, review output, and handle exceptions. AI handles routine execution at scale.

### 2. What are PRODUCE / GROW / OPERATE?
Three meta-capabilities:
- **PRODUCE**: Build things (engineering)
- **GROW**: Get customers (marketing/content)
- **OPERATE**: Keep things running (support/ops)

### 3. How does the orchestrator work?
1. You provide natural language intent ("Write a blog post about AI for solo builders")
2. Claude analyzes and generates specific tasks
3. Tasks are dispatched to workflow endpoints in parallel
4. Results aggregate and track completion

### 4. Why is there no OrchestrationPanel UI?
Instance 19 was planned to build it but didn't complete. The orchestrator backend is fully functional—you just have to use curl commands to interact with it.

### 5. How does Mandrel fit in?
Mandrel stores completed workflows as "completions". Before each new workflow, the system queries Mandrel for relevant past work to inform the AI's analysis. This creates institutional memory that improves over time.

---

## The Vision

A solo builder with this system doesn't compete on headcount. They compete on:
- **Speed**: No meetings, no approvals, no coordination overhead
- **Consistency**: AI doesn't have bad days, doesn't forget processes
- **Availability**: 24/7 operation, global coverage
- **Focus**: Human attention goes only to high-value activities
- **Leverage**: One person directing AI that produces the output of many

---

*This is the foundation. What happens next depends on real-world usage and iteration.*
