# RidgeTop AI - Solo Builder Workflow v1

**Created by:** Instance 05
**Purpose:** Document the workflow for solo builder + AI feature development
**Status:** Initial version - testing hypothesis

---

## Overview

This workflow enables a solo builder to complete feature development cycles with AI assistance, targeting 2-hour completion vs traditional 2-4 day cycles.

The key insight: AI does the *execution*, human provides *direction* and *judgment*.

---

## The Workflow

### Phase 1: Direction (5-10 minutes)

**Human provides:**
1. Task description in natural language
2. Context hints (optional): specific files, patterns to follow, constraints
3. Acceptance criteria: what "done" looks like

**Example:**
```
Task: Add user preferences API endpoint
Context: Follow patterns in src/api/users.ts
Acceptance:
- GET /api/users/:id/preferences returns stored prefs
- PUT /api/users/:id/preferences updates prefs
- Include theme, timezone, notifications settings
- Unit tests pass
```

### Phase 2: Context Assembly (1-2 minutes)

**Tool gathers:**
1. Relevant code files matching task entities
2. Related test patterns
3. Mandrel project context (prior decisions, patterns)

**Command:**
```bash
./tools/context-gather.sh -m -p ~/projects/myapp "Add user preferences API endpoint"
```

**Output:** Formatted markdown with:
- Relevant source files
- Mandrel context (decisions, prior work)
- Token-budget-aware truncation

### Phase 3: Plan Generation (AI, 2-5 minutes)

**AI produces:**
1. List of files to create/modify
2. Approach summary
3. Identified risks or questions

**Human reviews and adjusts before execution.**

### Phase 4: Execution (AI, 10-30 minutes)

**AI implements:**
1. Code changes across all identified files
2. Tests for new functionality
3. Documentation updates if needed

**Human monitors but doesn't intervene unless blocked.**

### Phase 5: Review (10-20 minutes)

**Human verifies:**
1. Code follows project patterns
2. Tests are comprehensive
3. Edge cases handled
4. No security issues introduced

**AI assists with:**
- Explaining decisions made
- Suggesting improvements
- Identifying missed cases

### Phase 6: Completion (5 minutes)

1. Run build/tests to verify
2. Commit with descriptive message
3. Store completion context to Mandrel

---

## Session Discipline

### Starting a Session

Always begin by retrieving prior context:

```bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent \
  -H "Content-Type: application/json" \
  -d '\''{"arguments": {"limit": 5}}'\''"
```

This ensures continuity with previous work sessions.

### Ending a Session

Always store your progress:

```bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store \
  -H "Content-Type: application/json" \
  -d '\''{"arguments": {
    "content": "Session summary: What was accomplished, what remains, blockers",
    "type": "handoff",
    "tags": ["session", "project-name"]
  }}'\''"
```

### During Work

Store significant decisions and completions:

```bash
# When you complete a feature
ssh hetzner 'curl -s ... "type": "completion" ...'

# When you make an architectural decision
ssh hetzner 'curl -s ... "type": "decision" ...'

# When you learn something important
ssh hetzner 'curl -s ... "type": "reflections" ...'
```

---

## Timing Targets

| Phase | Target | Notes |
|-------|--------|-------|
| Direction | 5-10 min | Be specific, clear criteria |
| Context Assembly | 1-2 min | Automated tool |
| Plan Generation | 2-5 min | Review before proceed |
| Execution | 10-30 min | Varies by complexity |
| Review | 10-20 min | Critical quality gate |
| Completion | 5 min | Tests + commit + context |
| **Total** | **33-72 min** | Target: under 2 hours |

---

## When This Workflow Works Best

**Good fit:**
- Features that follow existing patterns
- CRUD operations, API endpoints
- Bug fixes with clear reproduction
- Refactoring with clear targets
- Documentation updates

**Less efficient:**
- Novel architecture decisions
- Complex debugging (investigation heavy)
- Features requiring extensive research
- Highly creative UI work

---

## Tools

### context-gather.sh

Location: `~/projects/ridgetopai-alpha/tools/context-gather.sh`

```bash
# Basic usage
./tools/context-gather.sh "task description"

# With specific project
./tools/context-gather.sh -p ~/projects/myapp "task description"

# With Mandrel context
./tools/context-gather.sh -m "task description"

# Include test files
./tools/context-gather.sh -t "task description"

# Output to file
./tools/context-gather.sh -o context.md "task description"
```

### Mandrel Context Commands

```bash
# Store context
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store -H "Content-Type: application/json" -d '\''{"arguments": {"content": "...", "type": "completion", "tags": ["..."]}}'\'''

# Get recent context
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent -H "Content-Type: application/json" -d '\''{"arguments": {"limit": 5}}'\'''

# Search context
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_search -H "Content-Type: application/json" -d '\''{"arguments": {"query": "search terms", "limit": 5}}'\'''
```

---

## Hypothesis Being Tested

**Claim:** A solo builder can complete a full feature cycle in under 2 hours with AI, versus 2-4 days traditionally.

**Evidence needed:**
1. Actual timing data from real features
2. Quality metrics (bug rate, rework needed)
3. Complexity categorization (which features hit targets)

**This workflow is v1 - expect iteration based on actual usage.**

---

*Created: Instance 05 of ridgetopai-alpha*
*Purpose: Validate workflow before building infrastructure*
