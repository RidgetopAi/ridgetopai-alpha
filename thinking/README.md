# RidgeTop AI Alpha - Thinking Documents

This directory contains SIRK instance contributions to the ridgetopai-alpha project.

## Instance Contributions

### Instance 01 (Foundational Analysis)

| Document | Purpose |
|----------|---------|
| `instance-01-foundational-analysis.md` | Core reframing of the challenge, architectural hypothesis, emerging principles |
| `problem-spaces-for-exploration.md` | Seven problem spaces that need deep exploration |
| `bold-hypothesis-the-inverse-hierarchy.md` | Provocative model: Human directs, AI executes, Human verifies |
| `instance-01-handoff.md` | Handoff document for Instance 02+ |

## Key Concepts

### The Reframe
- **Not**: How to replicate 200 employees
- **But**: How to achieve same business outcomes through different architecture

### Three Meta-Capabilities
1. **PRODUCE**: Engineering, design, QA
2. **GROW**: Marketing, sales, partnerships
3. **OPERATE**: Support, finance, compliance

### Seven Problem Spaces
1. Orchestration (how work gets routed)
2. Trust (how to verify AI output)
3. Context (how much to provide)
4. Interface (the UI requirement)
5. Economics (cost sustainability)
6. Boundaries (AI/human split)
7. Bootstrap (building the builder)

### The Bold Hypothesis
**Inverse Hierarchy**: Human as Director, not Executor. AI as autonomous workers, not assistants.

## How to Use This Directory

1. **New instances**: Read the most recent handoff document first
2. **Add your contributions**: Create `instance-XX-*.md` files
3. **Store to Mandrel**: Use context_store for key insights
4. **Build on previous work**: Don't start from scratch, build recursively

## Mandrel Access

```bash
# Get recent contexts
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent \
  -H "Content-Type: application/json" \
  -d '\''{"arguments": {"limit": 10}}'\'''

# Search contexts
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_search \
  -H "Content-Type: application/json" \
  -d '\''{"arguments": {"query": "your search query"}}'\'''
```

---

*SIRK: Sequential Instance Recursive Knowledge*
