# Instance 03: Infrastructure Analysis and Integration Path

**Instance**: 3 of 20 in ridgetopai-alpha (continuation run)
**Date**: 2026-01-21
**Focus**: Grounding conceptual work in existing infrastructure

---

## My Approach

Previous instances created excellent conceptual frameworks:
- Instance 01: Inverse Hierarchy, PRODUCE/GROW/OPERATE capabilities
- Instance 02: Verification-Cost Tiers, coherence mechanisms, economics
- Earlier Instance 03: Progressive Autonomy, human bandwidth problem

My contribution: Moving from CONCEPTUAL to MECHANICAL understanding.

I asked: What actually EXISTS vs. what we're designing from scratch?

---

## Key Discovery: Infrastructure is More Mature Than Expected

### Mandrel (7,700 LOC in handlers)
- **Task Management**: Already has CRUD, dependencies, session linking, priority
- **Agent Coordination**: Registration, messaging, collaboration primitives
- **Context Storage**: pgvector embeddings, semantic search, 384-dimensional vectors
- **Session Analytics**: Activity tracking, retention metrics, productivity scoring

### Forge (working orchestrator)
- **Multi-instance coordination**: Sequential runs with state persistence
- **Event streaming**: JSONL format for progress updates
- **State recovery**: Resumable runs via state files
- **Timeout handling**: Configurable per-instance with retry logic

### Surveyor (code analysis patterns)
- **AST parsing**: Imports, exports, functions, classes via ts-morph
- **Behavioral analysis**: LLM-based summaries with concurrency control
- **Caching**: Content hashing for incremental analysis
- **Convention awareness**: Next.js routes, middleware, API handlers

### Squire (UI patterns)
- **Multi-panel architecture**: Dashboard, timeline, graph views
- **Real-time updates**: WebSocket communication
- **Graph visualization**: Entity relationships, force-directed layouts
- **State management**: Zustand, React Query patterns

---

## The State Problem (Key Insight)

Previous instances described orchestration as "routing tasks to capabilities." But orchestration is fundamentally about STATE MANAGEMENT.

### Task Lifecycle States Needed:
```
INTAKE → CLASSIFICATION → CONTEXT_GATHERING → PLANNING →
PLAN_REVIEW → EXECUTION → OUTPUT_STAGING → VERIFICATION →
FEEDBACK_CAPTURE → COMPLETION
```

Not all tasks go through all states:
- **Tier A**: INTAKE → CLASSIFICATION → CONTEXT_GATHERING → EXECUTION → COMPLETION
- **Tier B**: Full flow with sampled verification
- **Tier C**: Full flow with plan review and verification
- **Tier D**: Context gathering then human executes

---

## The Context Assembly Problem (Key Insight)

This is the hidden complexity. When AI executes a task, it needs context from MULTIPLE sources dynamically assembled.

### Example: Code Review Task
| Context Type | Source | Gathering Method |
|--------------|--------|------------------|
| Codebase architecture | Code itself | Surveyor/AST indexing |
| Coding standards | Documentation | Mandrel context or config |
| Related changes | Git history | git log, git blame |
| Purpose | Issue tracker | GitHub/Linear API |
| Test coverage | Test files | Test runner output |

### Context Assembly Pipeline:
```
Task → Classifier → Determine context needs
     → Context Gatherers (parallel) → Fetch from sources
     → Context Compiler → Prioritize, truncate, format
     → AI Execution → Execute with full context
```

Key insight: The orchestration layer is largely a CONTEXT ASSEMBLY system. Task routing is easy. Context assembly is hard.

---

## Revised MVP Definition

Given existing infrastructure, the MVP is INTEGRATION not INVENTION.

### Phase 1: Extend Mandrel Task System (2 instances)
- Add lifecycle states to existing tasks
- Add classification fields (tier, capability, urgency)
- Add review/approval tracking
- **EXTENSION of existing infrastructure**

### Phase 2: Build Context Assembly Service (2 instances)
- Service that gathers context from multiple sources
- Integrates Surveyor patterns for code context
- Connects to Mandrel for semantic context
- Token budget management

### Phase 3: Simple Review UI (1-2 instances)
- Extend Mandrel Command UI patterns
- Task queue view with prioritization
- Review/approval interface
- Basic dashboard

### Phase 4: Integration with Forge (1 instance)
- Connect Forge orchestrator to new Mandrel task workflow
- Enable Forge runs to create/update Mandrel tasks
- Event streaming for progress updates

**Total**: 6-8 focused instances

---

## A Day in the Life (Concrete Scenario)

### Morning (8am)
- Check overnight activity (AI worked while sleeping)
- Queue: 1 escalated ticket, 1 spot-check, 2 blog drafts, 2 test failures
- Total morning review: ~45-60 minutes

### Direction Giving (9am)
- Natural language: "Add new API endpoint for user preferences"
- System: classify → gather context → plan → show plan → execute → stage for review
- Brian approves plan, reviews PR later

### Async Work (1pm)
- AI continues on approved tasks while Brian in customer call
- Tier A tasks auto-complete
- Pre-approved campaigns execute

### End of Day (5pm)
- Summary review
- Trust calibration stats
- Outcome metrics

**Key Insight**: System designed around MINIMIZING INTERRUPTION while MAXIMIZING LEVERAGE.

---

## What I Contributed

1. **State Machine Analysis**: Defined task lifecycle states and tier-specific flows
2. **Context Assembly Pipeline**: Identified the hidden complexity and proposed architecture
3. **Infrastructure Analysis**: Comprehensive exploration of all reference projects
4. **Integration Strategy**: Shifted from designing new systems to integrating existing ones
5. **Concrete Scenario**: Day-in-life model that should drive UI design
6. **Revised MVP**: More realistic 6-8 instance plan

---

## Open Questions for Future Instances

1. **Mandrel Task Schema**: What specific fields need to be added?
2. **Context Gatherer Interface**: How do plugins register and get discovered?
3. **Trust Calibration Storage**: In Mandrel or separate service?
4. **UI Technology**: Extend Mandrel Command or build with Squire patterns?
5. **First Workflow**: What specific PRODUCE task to implement first?

---

## Self-Challenges (for Future Instances to Consider)

1. Am I being too conservative by focusing on integration?
2. Is 6-8 instance estimate realistic?
3. Is PRODUCE the right first capability?

---

## Recommendation for Instance 04

**Option A (Recommended)**: Design Mandrel task schema extension
- Review existing tasks.ts handler
- Define exact new fields
- Draft migration SQL

This is concrete technical work on proven infrastructure.

---

*Instance 03 (continuation) - Infrastructure Analysis Complete*
*Key shift: Conceptual → Mechanical understanding*
*Stored to Mandrel for SIRK continuation*
