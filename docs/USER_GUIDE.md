# RidgeTop AI Alpha - User Guide

## Quick Start

### Prerequisites
- Node.js 18+
- Claude CLI installed and configured (`claude --version` should work)
- Mandrel server accessible at https://mandrel.ridgetopai.net

### Starting the System

**1. Start the Backend**
```bash
cd ~/projects/ridgetopai-alpha/backend
npm run build
PORT=3003 node dist/index.js
```

You should see:
```
[TaskRunner] Server running on http://localhost:3003
[TaskRunner] Health check: http://localhost:3003/health
[TaskRunner] Bug fix endpoint: POST http://localhost:3003/api/workflow/bugfix
[TaskRunner] Content endpoint: POST http://localhost:3003/api/workflow/content
[TaskRunner] Orchestrator endpoint: POST http://localhost:3003/api/orchestrate
```

**2. Start the UI** (optional - for visual interface)
```bash
cd ~/projects/ridgetopai-alpha/ui
npm run dev
```

Access at http://localhost:5173

**3. Configure Environment** (if needed)
Create `.env` in the UI directory:
```
VITE_USE_REAL_BACKEND=true
VITE_TASKRUNNER_URL=http://localhost:3003
```

---

## Using the Bug Fix Workflow (PRODUCE)

### Via UI

1. Open the dashboard in your browser
2. In the **Bug Fix Workflow** panel (left side), click **Start Bug Fix**
3. Fill in the form:
   - **Title**: Short description of the bug
   - **Description**: Detailed explanation
   - **Severity**: blocker, major, or minor
   - **Steps to Reproduce**: (optional) How to trigger the bug
4. Click **Submit**
5. Wait for AI analysis (typically 15-30 seconds)
6. Review the proposed fix:
   - Root cause analysis
   - Evidence from codebase
   - Proposed code changes
   - Risks and test needs
7. Click **Approve** to implement or **Reject** to cancel
8. If approved, AI implements changes and runs tests
9. View completion summary

### Via API

```bash
# Submit bug for analysis
curl -X POST http://localhost:3003/api/workflow/bugfix \
  -H 'Content-Type: application/json' \
  -d '{
    "workflowId": "bug-001",
    "bugReport": {
      "title": "Login button not responding",
      "description": "Clicking the login button does nothing. No errors in console.",
      "severity": "major"
    },
    "projectPath": "/path/to/your/project"
  }'

# Check status
curl http://localhost:3003/api/workflow/bug-001

# Implement approved fix (after reviewing the analysis)
curl -X POST http://localhost:3003/api/workflow/bugfix/bug-001/implement \
  -H 'Content-Type: application/json' \
  -d '{
    "approvedChanges": [
      {
        "file": "src/auth.ts",
        "original": "function handleLogin() {",
        "proposed": "async function handleLogin() {",
        "explanation": "Make function async to properly await auth"
      }
    ],
    "runTests": true
  }'
```

---

## Using the Content Workflow (GROW)

### Via UI

1. Open the dashboard
2. In the **Content Generation** panel (right side), click **Create Content**
3. Fill in the brief:
   - **Title**: What you're creating
   - **Topic**: Subject matter
   - **Format**: blog_post, tweet_thread, documentation, email, announcement, case_study
   - **Audience**: developers, business, general, internal
   - **Tone**: professional, conversational, technical, educational
   - **Key Points**: (optional) Specific points to cover
4. Click **Generate**
5. Wait for AI generation (typically 10-20 seconds)
6. Review the generated content:
   - Full content preview
   - Confidence level
   - Suggestions and alternatives
7. Click **Approve** to finalize, **Request Changes** to refine, or **Reject**
8. If requesting changes, provide feedback and specific edits
9. AI refines and returns updated content
10. Click **Copy to Clipboard** when satisfied

### Via API

```bash
# Generate content
curl -X POST http://localhost:3003/api/workflow/content \
  -H 'Content-Type: application/json' \
  -d '{
    "workflowId": "content-001",
    "brief": {
      "title": "AI for Solo Builders",
      "topic": "How AI enables solo builders to compete with larger teams",
      "format": "blog_post",
      "audience": "developers",
      "tone": "professional",
      "keyPoints": [
        "The Inverse Hierarchy model",
        "PRODUCE, GROW, OPERATE capabilities",
        "Institutional memory with Mandrel"
      ]
    }
  }'

# Check status
curl http://localhost:3003/api/workflow/content/content-001

# Refine content based on feedback
curl -X POST http://localhost:3003/api/workflow/content/content-001/refine \
  -H 'Content-Type: application/json' \
  -d '{
    "originalContent": {
      "title": "AI for Solo Builders",
      "body": "... the generated content ..."
    },
    "feedback": "Make it more conversational and add a personal anecdote about building RidgeTop AI",
    "specificEdits": [
      "Shorten the introduction",
      "Add concrete examples"
    ]
  }'
```

---

## Using the Orchestrator (Natural Language → Tasks)

The orchestrator is the most powerful feature—give it high-level intent and it generates specific tasks.

**Note**: There is no UI for this yet. Use curl commands.

### Create an Orchestration Session

```bash
curl -X POST http://localhost:3003/api/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "session-001",
    "intent": "Write a blog post announcing RidgeTop AI and explaining our vision for AI-human collaboration"
  }'
```

Response includes:
- `interpretation.understood`: What the orchestrator understood
- `interpretation.reasoning`: Why it chose these tasks
- `interpretation.tasks`: Array of generated tasks with type, priority, parameters

### Review Generated Tasks

```bash
curl http://localhost:3003/api/orchestrate/session-001
```

### Execute All Tasks

```bash
curl -X POST http://localhost:3003/api/orchestrate/session-001/execute
```

This dispatches all pending tasks to their respective workflows (bugfix, content, etc.) in parallel.

### Check Execution Status

```bash
curl http://localhost:3003/api/orchestrate/session-001
```

Shows completion counts: total, completed, failed, pending, running.

### Full Example

```bash
# Step 1: Create session with complex intent
curl -X POST http://localhost:3003/api/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "launch-prep",
    "intent": "Prepare for RidgeTop AI launch: write an announcement blog post, create a tweet thread teaser, and fix that login bug we discussed"
  }'

# Step 2: Review what the orchestrator generated
curl http://localhost:3003/api/orchestrate/launch-prep | jq '.session.interpretation'

# Step 3: If tasks look good, execute them all
curl -X POST http://localhost:3003/api/orchestrate/launch-prep/execute

# Step 4: Monitor progress
watch -n 5 'curl -s http://localhost:3003/api/orchestrate/launch-prep | jq ".session.execution"'
```

---

## Storing to Mandrel (Memory)

After completing workflows, store them to Mandrel for institutional memory.

### Store Bug Fix Completion

```bash
curl -X POST http://localhost:3003/api/mandrel/bugfix/bug-001/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "bugReport": {
      "title": "Login button not responding",
      "description": "...",
      "severity": "major"
    },
    "analysis": {
      "rootCause": "Missing async/await in auth handler",
      "evidence": "Found in src/auth.ts:142",
      "confidence": "high"
    },
    "review": {
      "decision": "approved"
    }
  }'
```

### Store Content Completion

```bash
curl -X POST http://localhost:3003/api/mandrel/content/content-001/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "brief": { ... },
    "generation": { ... },
    "review": {
      "decision": "approved"
    }
  }'
```

### Search Mandrel for Context

```bash
curl -X POST http://localhost:3003/api/mandrel/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login authentication bugs",
    "limit": 5
  }'
```

### Get Recent Workflows

```bash
curl http://localhost:3003/api/mandrel/recent?limit=10
```

---

## Tips for Effective Use

### Bug Fix Workflow
1. **Be specific** in bug descriptions—include error messages, affected files if known
2. **Include reproduction steps** when possible
3. **Set correct severity**—blockers get higher priority in orchestration
4. **Review proposed changes carefully**—check file paths and code snippets

### Content Workflow
1. **Fill in key points**—more guidance = better results
2. **Choose the right format**—blog_post vs tweet_thread have very different outputs
3. **Use refinement** for iterative improvement rather than rejecting and starting over
4. **Match audience and tone** to your actual target

### Orchestrator
1. **Give rich intent**—"Write a blog post" is okay, "Write a blog post announcing our new feature to developers, highlighting the technical benefits" is better
2. **Review generated tasks** before executing—the AI might misinterpret
3. **Use context parameters** when you have constraints:
   ```json
   "context": {
     "focus": "marketing",
     "urgency": "high"
   }
   ```

---

## Troubleshooting

### Backend won't start
- Check if port 3001/3002/3003 is in use: `lsof -i :3003`
- Verify Claude CLI works: `claude --version`
- Check build: `npm run build` should produce no errors

### UI can't connect to backend
- Verify backend is running: `curl http://localhost:3003/health`
- Check VITE_TASKRUNNER_URL in .env matches backend port
- Check browser console for CORS errors

### Workflows timeout
- Default timeout is 5 minutes (300000ms)
- Complex codebases may need longer analysis
- Check backend logs for Claude CLI output

### Mandrel not connecting
- Verify Mandrel is up: `curl https://mandrel.ridgetopai.net/mcp/tools/mandrel_ping -X POST -H 'Content-Type: application/json' -d '{"arguments": {}}'`
- Check MANDREL_URL environment variable if using non-default

---

## Next Steps

After getting comfortable with individual workflows:

1. **Use the orchestrator** for multi-task work
2. **Store completions to Mandrel** to build institutional memory
3. **Build your own OrchestrationPanel** (it's the main missing piece)
4. **Add OPERATE workflows** for support/monitoring

The system is a foundation. Iterate based on what you actually need.
