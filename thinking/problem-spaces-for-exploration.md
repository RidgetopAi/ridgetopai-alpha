# Problem Spaces for SIRK Exploration

**Created by**: Instance 01
**Purpose**: Guide future instances toward productive exploration areas

---

## Problem Space 1: The Orchestration Problem

**The Challenge**: In a traditional company, work gets routed through managers, meetings, and processes. Who decides what AI does next in our system?

### Questions to Explore:

1. **Event-Driven vs Scheduled**: Should work be triggered by events (customer email, support ticket, deployment) or run on schedules (daily content, weekly reports)?

2. **Priority Systems**: How do we handle competing priorities? Customer emergency vs planned feature work vs marketing deadline?

3. **Resource Allocation**: If multiple AI tasks need to run, how do we sequence them? Cost limits? Parallelization?

4. **Human Attention Budget**: The solo builder is the scarcest resource. How do we minimize demands on their attention while maximizing effectiveness?

### Potential Approaches:

**A. Centralized Orchestrator**
- Single system decides all task routing
- Pros: Coherent decisions, single source of priority
- Cons: Single point of failure, complexity

**B. Distributed Queue System**
- Each capability has its own queue
- Human sets priorities per queue
- Pros: Simpler, more resilient
- Cons: May lack coherence across capabilities

**C. Priority Rules Engine**
- Define rules: "Customer issues > planned work"
- System applies rules automatically
- Human reviews exceptions
- Pros: Predictable, auditable
- Cons: Rules can conflict, may need frequent tuning

**D. Attention-Based Model**
- System tracks what human is focused on
- Routes related work, defers unrelated
- Pros: Matches human context
- Cons: May delay important work

### What I'd Test:
Build a simple rule-based system first. Let patterns emerge from real use. Don't over-engineer orchestration before understanding what needs orchestrating.

---

## Problem Space 2: The Trust Problem

**The Challenge**: How does the solo builder trust AI output enough to send it to customers, commit it to code, or make decisions from it?

### Questions to Explore:

1. **Verification Burden**: If every AI output needs human review, we haven't saved time. What can be trusted without review?

2. **Confidence Signals**: Can AI communicate its confidence? "I'm 95% sure this is right" vs "I'm uncertain, please review"?

3. **Rollback Capability**: If AI makes a mistake, how easily can we recover?

4. **Audit Trails**: For compliance and debugging, can we see why AI did what it did?

### Trust Tiers (Hypothesis):

**Tier 1: Full Autonomy** (no review needed)
- Internal organization (file management, scheduling)
- Draft generation (human reviews before sending)
- Information gathering (research, summarization)
- Monitoring and alerting (detecting anomalies)

**Tier 2: Verification Required** (human approves before action)
- Customer communication
- Code deployment
- Financial transactions
- Public content publication

**Tier 3: Human Initiates** (AI assists, human drives)
- Strategic decisions
- Contract negotiation
- Relationship management
- Crisis response

### What I'd Test:
Start with Tier 2 for everything. Gradually move proven tasks to Tier 1 based on track record. Never move to Tier 3 - that's inherently human domain.

---

## Problem Space 3: The Context Problem

**The Challenge**: AI effectiveness depends heavily on context. Too little = poor results. Too much = expensive, slow, possibly confused.

### Questions to Explore:

1. **Context Selection**: How do we choose what context to include for each task?

2. **Context Freshness**: When does old context become harmful rather than helpful?

3. **Cross-Capability Context**: Should marketing AI know what engineering AI is building? When?

4. **Context Compression**: Can we summarize context without losing critical details?

### Context Categories:

**Persistent Context** (always relevant)
- Company identity, values, voice
- Product capabilities and limitations
- Customer segments and personas
- Competitive positioning

**Situational Context** (relevant to specific tasks)
- Current project status
- Recent customer interactions
- Active issues/tickets
- In-progress work

**Historical Context** (sometimes relevant)
- Past decisions and rationale
- Previous customer history
- Lessons learned
- Deprecated features/approaches

### Patterns from Existing Systems:

**Squire's Approach**: Salience scoring (temporal, relationships, action language, self-reference). Generate narratives from graph traversal, not just top-N chunks.

**Mandrel's Approach**: Type-based organization (code, decision, planning, etc.) with semantic search.

### What I'd Test:
Implement layered context injection:
1. Core context always included (identity, product, voice)
2. Task-specific context selected by relevance
3. Historical context pulled on-demand when needed
4. Strict token budgets per layer

---

## Problem Space 4: The Interface Problem

**The Challenge**: The UI determines the solo builder's effectiveness. Every friction multiplies across all interactions.

### Questions to Explore:

1. **Information Density**: How much to show? Dashboard overwhelm vs missing critical info?

2. **Notification Strategy**: What deserves interruption? What can wait?

3. **Input Modality**: Type commands? Click buttons? Voice? Depends on context?

4. **Mobile vs Desktop**: Different needs for quick checks vs deep work?

### Interface Principles (Hypothesis):

1. **Overview First**: Start with high-level status. Drill down as needed.

2. **Action-Oriented**: Every screen should make clear what actions are possible/needed.

3. **Progressive Disclosure**: Hide complexity until needed. Expert features exist but don't clutter.

4. **Keyboard-First**: Power users should never need a mouse. But mouse works for discovery.

5. **Notifications with Context**: Never just "alert!" Always "X happened because Y, options are Z."

### Screens to Consider:

**Dashboard/Home**
- System status overview
- Pending decisions
- Active work across capabilities
- Recent significant events

**Capability Views**
- PRODUCE: Code status, deployments, bugs
- GROW: Lead pipeline, content queue, metrics
- OPERATE: Support queue, financial health, compliance

**Decision Interface**
- Context presented
- Options with analysis
- Quick action buttons
- "Explain more" option

**Work Direction Interface**
- Natural language input
- AI clarifying questions
- Progress tracking
- Output review

### What I'd Test:
Start with command-line + simple web dashboard. Don't build elaborate UI until we know what information matters. Ridge-Control pattern (TUI) might be right starting point.

---

## Problem Space 5: The Economics Problem

**The Challenge**: AI API costs can be significant. How do we make this economically viable?

### Questions to Explore:

1. **Cost per Task**: What does it cost to write a blog post, answer a support ticket, generate code?

2. **ROI Calculation**: If AI support costs $0.10/ticket but hiring costs $X/ticket, what's the threshold?

3. **Optimization Strategies**: Caching, smaller models for simple tasks, batching?

4. **Scaling Economics**: Do costs scale linearly with business growth or better/worse?

### Cost Categories:

**High-Cost Operations**
- Long-form content generation
- Complex code generation
- Deep analysis tasks
- Multi-turn conversations

**Low-Cost Operations**
- Classification and routing
- Simple Q&A
- Template filling
- Status checks

### Optimization Strategies:

1. **Model Tiering**: Use cheap/fast models (Haiku, Grok) for simple tasks. Reserve expensive models (Opus) for complex work.

2. **Caching**: Cache common responses. Customer FAQ can be answered from cache.

3. **Batching**: Aggregate similar tasks. Generate week's social posts at once.

4. **Local Models**: Some tasks can run on local/free models. Embeddings, classification.

5. **Human Threshold**: For rare/critical tasks, human might be cheaper than AI iteration.

### What I'd Test:
Track cost per operation from day one. Build cost awareness into the system. Set budgets per capability. Alert when approaching limits.

---

## Problem Space 6: The Capability Boundaries

**The Challenge**: For each business function, what's the exact split between AI and human?

### Framework for Analysis:

For each function, ask:
1. Can AI do this with current technology?
2. What's the quality level vs human?
3. What's the cost comparison?
4. What are the failure modes?
5. What's required for human oversight?

### Detailed Function Analysis:

**Code Writing**
- AI capability: High (proven with many projects)
- Quality: Good for standard patterns, needs review for novel architecture
- Human role: Direction, architecture decisions, code review
- Boundary: Human designs, AI implements, human reviews

**Customer Support (Tier 1)**
- AI capability: High (many companies doing this)
- Quality: Good for known issues, poor for novel problems
- Human role: Handle escalations, edge cases
- Boundary: AI handles known patterns, escalates unknowns

**Content Creation**
- AI capability: High (writing is an AI strength)
- Quality: Good first drafts, needs human editing for voice
- Human role: Direction, editing, brand consistency
- Boundary: AI drafts, human refines and approves

**Sales Outreach**
- AI capability: Medium (can research, write, but can't build relationships)
- Quality: Good for research/prep, poor for relationship
- Human role: All relationship work, closing, negotiation
- Boundary: AI prepares, human executes

**Financial Management**
- AI capability: Medium (can process, categorize, report)
- Quality: Good for routine, poor for judgment calls
- Human role: Decisions, strategy, anomaly investigation
- Boundary: AI tracks, human decides

**Product Decisions**
- AI capability: Low for decisions, high for analysis
- Quality: Can provide data, can't make product calls
- Human role: All decisions, prioritization, vision
- Boundary: AI analyzes and presents, human decides

### What I'd Test:
Start with clear boundaries. Track where AI succeeds and fails. Adjust boundaries based on evidence, not theory.

---

## Problem Space 7: The Bootstrap Problem

**The Challenge**: This system needs to exist to help build itself. How do we sequence development?

### The Chicken-and-Egg:
- We need orchestration to coordinate AI work
- Building orchestration requires coordinated AI work
- We need the UI to manage the system
- Building the UI requires the system to manage

### Bootstrap Sequence (Hypothesis):

**Phase 0: Foundation** (Manual coordination)
- Use existing tools (Mandrel, Surveyor)
- Human coordinates manually
- Build minimal shared infrastructure
- Goal: Prove core concepts work

**Phase 1: Context Core** (Extend Mandrel)
- Customer context system
- Enhanced task management
- Basic workflow automation
- Goal: AI can work with richer context

**Phase 2: First Capability** (Pick one to build fully)
- Recommend: OPERATE (Support) - most contained
- Full AI workflow for support tickets
- Human escalation path
- Goal: Prove capability model works

**Phase 3: Orchestration MVP** (Connect pieces)
- Event-driven triggers
- Basic priority rules
- Cross-capability awareness
- Goal: Automated coordination

**Phase 4: Dashboard MVP** (Human interface)
- Overview screen
- Decision interface
- Work direction
- Goal: Human can manage via UI

**Phase 5: Additional Capabilities** (Expand)
- Add GROW capability
- Add PRODUCE capability
- Refine based on learnings
- Goal: Full capability coverage

**Phase 6: Polish & Scale** (Production ready)
- Performance optimization
- Cost optimization
- Reliability hardening
- Goal: Sustainable operation

### What I'd Test:
Follow this sequence loosely. Be willing to adjust based on what we learn. Don't plan too far ahead - the landscape will change as we build.

---

## Recommendations for Future Instances

### Instance 2-3: Deep Dive Capability Analysis
- Take one capability (PRODUCE, GROW, or OPERATE)
- Map every function in detail
- Propose specific AI/human boundaries
- Design the workflow

### Instance 4-5: Technical Architecture
- Design the orchestration layer
- Design the context injection system
- Design the integration layer
- Create technical specifications

### Instance 6-7: Prototype Planning
- Identify what to build first
- Design the bootstrap sequence
- Create development roadmap
- Define success criteria

### Instance 8-10: Build Core Components
- Start implementing
- Test theories with code
- Iterate based on learnings

### Instance 11-15: Build First Capability
- Full implementation of one capability
- UI for that capability
- Integration with Mandrel

### Instance 16-20: Expand and Polish
- Additional capabilities
- Full dashboard
- Production readiness

---

*This document is a starting point, not a constraint. Future instances should challenge these ideas, not just follow them.*
