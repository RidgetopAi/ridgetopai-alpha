# RidgeTop AI - Quick Start Guide

**For Brian - Getting Started Today**

---

## Prerequisites

- Node.js installed
- Claude CLI available (`claude --version`)
- Mandrel running on VPS (check: `ssh hetzner curl http://localhost:8080/mcp/tools/mandrel_ping -X POST -H "Content-Type: application/json" -d '{"arguments":{}}'`)

---

## 1. Start the Backend

```bash
cd ~/projects/ridgetopai-alpha/backend

# Build (if needed)
npm run build

# Start on available port
PORT=3003 node dist/index.js
```

You should see:
```
[TaskRunner] Server running on http://localhost:3003
[TaskRunner] Health check: http://localhost:3003/health
```

---

## 2. Verify It's Working

```bash
# Health check
curl http://localhost:3003/health

# Expected output:
# {"status":"ok","timestamp":"...","claudeAvailable":true,"mandrelAvailable":true}
```

---

## 3. Try the Orchestrator

This is the core capability - give natural language direction, get parallel task execution.

### Step 1: Create an Orchestration Session

```bash
curl -X POST http://localhost:3003/api/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "brian-first-test",
    "intent": "Write a blog post announcing RidgeTop AI and explaining how AI enables solo builders to compete with larger companies"
  }'
```

### Step 2: Review Generated Tasks

The orchestrator will use Claude to analyze your intent and generate specific tasks. Review what it came up with:

```bash
curl http://localhost:3003/api/orchestrate/brian-first-test
```

You'll see something like:
```json
{
  "success": true,
  "session": {
    "interpretation": {
      "understood": "...",
      "reasoning": "...",
      "tasks": [
        {
          "type": "content",
          "priority": "high",
          "title": "...",
          "description": "..."
        }
      ]
    }
  }
}
```

### Step 3: Execute the Tasks

If the generated tasks look good, execute them:

```bash
curl -X POST http://localhost:3003/api/orchestrate/brian-first-test/execute
```

### Step 4: Check Results

```bash
curl http://localhost:3003/api/orchestrate/brian-first-test
```

The session will show completed tasks with their results (including the full generated content).

---

## 4. Try Individual Workflows

### Bug Fix Workflow (PRODUCE)

```bash
curl -X POST http://localhost:3003/api/workflow/bugfix \
  -H 'Content-Type: application/json' \
  -d '{
    "workflowId": "my-bug-1",
    "bugReport": {
      "title": "Login button unresponsive",
      "description": "When users click the login button, nothing happens. No error messages, no loading indicator.",
      "severity": "major",
      "stepsToReproduce": "1. Go to login page\n2. Enter credentials\n3. Click Login\n4. Nothing happens"
    }
  }'
```

### Content Generation (GROW)

```bash
curl -X POST http://localhost:3003/api/workflow/content \
  -H 'Content-Type: application/json' \
  -d '{
    "workflowId": "content-1",
    "brief": {
      "title": "Why AI-Human Collaboration Matters",
      "topic": "The future of work where AI and humans collaborate effectively",
      "format": "blog_post",
      "audience": "developers",
      "tone": "professional",
      "keyPoints": [
        "AI handles execution, humans provide direction",
        "Memory and context persistence are key",
        "The solo builder advantage"
      ]
    }
  }'
```

---

## 5. Start the UI (Optional)

If you want to use the visual dashboard:

```bash
cd ~/projects/ridgetopai-alpha/ui

# Development mode
npm run dev

# Then open http://localhost:5173 in your browser
```

Note: The UI has panels for Bug Fix and Content Generation, but **not yet for the Orchestrator**. That's a future enhancement.

---

## What You Can Do Now

1. **Test the orchestrator** with real directives
2. **Generate content** for RidgeTop AI marketing
3. **Analyze bugs** in your projects
4. **Store results to Mandrel** for institutional memory

---

## Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | System status |
| `/api/orchestrate` | POST | Create orchestration session |
| `/api/orchestrate/:id` | GET | Get session status |
| `/api/orchestrate/:id/execute` | POST | Execute all tasks |
| `/api/workflow/bugfix` | POST | Bug analysis |
| `/api/workflow/content` | POST | Content generation |
| `/api/mandrel/search` | POST | Search memory |

---

## Next Steps

After testing, consider:

1. **Is the orchestrator useful?** Does natural language → tasks feel right?
2. **What's missing?** What would make you actually USE this daily?
3. **UI needs?** Would an OrchestrationPanel help, or is curl fine?

Your feedback guides the next phase.

---

*Quick start guide - Instance 20*
