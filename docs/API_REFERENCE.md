# RidgeTop AI Alpha - API Reference

Base URL: `http://localhost:3001` (or configured PORT)

---

## Health & Discovery

### GET /health

Check system health including Claude CLI and Mandrel availability.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-01-22T00:00:00.000Z",
  "claudeAvailable": true,
  "mandrelAvailable": true
}
```

### GET /api/workflows

List available workflow types.

**Response**
```json
{
  "workflows": [
    {
      "type": "bugfix",
      "name": "Bug Fix Analysis",
      "description": "Analyze a bug report and propose a fix",
      "endpoint": "/api/workflow/bugfix",
      "implementEndpoint": "/api/workflow/bugfix/:id/implement",
      "capability": "PRODUCE"
    },
    {
      "type": "content",
      "name": "Content Generation",
      "description": "Generate marketing content, blog posts, and documentation",
      "endpoint": "/api/workflow/content",
      "refineEndpoint": "/api/workflow/content/:id/refine",
      "capability": "GROW"
    }
  ]
}
```

---

## Bug Fix Workflow (PRODUCE)

### POST /api/workflow/bugfix

Execute bug fix analysis.

**Request Body**
```json
{
  "workflowId": "string (required)",
  "bugReport": {
    "title": "string (required)",
    "description": "string (required)",
    "severity": "blocker | major | minor (required)",
    "stepsToReproduce": "string (optional)",
    "expectedBehavior": "string (optional)",
    "actualBehavior": "string (optional)"
  },
  "projectPath": "string (optional, defaults to cwd)"
}
```

**Response (Success)**
```json
{
  "success": true,
  "workflowId": "bug-001",
  "analysis": {
    "rootCause": "Description of what's causing the bug",
    "evidence": "Code references and reasoning",
    "confidence": "high | medium | low",
    "questions": ["Optional clarifying questions"],
    "proposedFix": {
      "explanation": "What the fix does and why",
      "changes": [
        {
          "file": "path/to/file.ts",
          "original": "original code snippet",
          "proposed": "proposed code change",
          "explanation": "why this change helps"
        }
      ],
      "risks": ["potential risks"],
      "testNeeds": ["tests to verify"]
    }
  },
  "durationMs": 29000
}
```

**Response (Failure)**
```json
{
  "success": false,
  "workflowId": "bug-001",
  "error": "Error message",
  "durationMs": 5000
}
```

### GET /api/workflow/:id

Get workflow status.

**Response**
```json
{
  "workflowId": "bug-001",
  "status": "analyzing | completed | failed",
  "message": "Current status message",
  "progress": 75,
  "result": { /* BugAnalysis if completed */ }
}
```

### POST /api/workflow/bugfix/:id/implement

Apply approved code changes.

**Request Body**
```json
{
  "approvedChanges": [
    {
      "file": "path/to/file.ts",
      "original": "original code",
      "proposed": "new code",
      "explanation": "optional"
    }
  ],
  "projectPath": "string (optional)",
  "runTests": true
}
```

**Response (Success)**
```json
{
  "success": true,
  "workflowId": "bug-001",
  "implementation": {
    "success": true,
    "changedFiles": ["path/to/file.ts"],
    "testResults": {
      "passed": 12,
      "failed": 0,
      "skipped": 2,
      "duration": 3400,
      "output": "test summary"
    },
    "warnings": [],
    "errors": []
  },
  "durationMs": 45000
}
```

---

## Content Workflow (GROW)

### POST /api/workflow/content

Generate content from a brief.

**Request Body**
```json
{
  "workflowId": "string (required)",
  "brief": {
    "title": "string (required)",
    "topic": "string (required)",
    "format": "blog_post | tweet_thread | documentation | email | announcement | case_study (required)",
    "audience": "developers | business | general | internal (required)",
    "tone": "professional | conversational | technical | educational (required)",
    "keyPoints": ["array of strings (optional)"],
    "keywords": ["array of strings (optional)"],
    "wordCount": "number (optional)",
    "additionalContext": "string (optional)"
  },
  "brandContext": "string (optional, brand voice guidelines)"
}
```

**Response (Success)**
```json
{
  "success": true,
  "workflowId": "content-001",
  "generation": {
    "content": {
      "title": "The generated title",
      "body": "Full content in markdown format",
      "summary": "1-2 sentence summary",
      "callToAction": "Clear CTA",
      "metadata": {
        "wordCount": 1200,
        "readTime": 5,
        "targetKeywords": ["AI", "solo builder"]
      }
    },
    "confidence": "high | medium | low",
    "suggestions": ["Improvement suggestions"],
    "alternatives": [
      {
        "title": "Alternative angle",
        "approach": "Description of alternative"
      }
    ]
  },
  "durationMs": 16000
}
```

### GET /api/workflow/content/:id

Get content workflow status.

**Response**
```json
{
  "workflowId": "content-001",
  "status": "generating | refining | completed | failed",
  "message": "Status message",
  "progress": 50,
  "result": { /* ContentGenerationResult if completed */ }
}
```

### POST /api/workflow/content/:id/refine

Refine content based on feedback.

**Request Body**
```json
{
  "originalContent": {
    "title": "string",
    "body": "string",
    "summary": "string (optional)",
    "callToAction": "string (optional)"
  },
  "feedback": "string (required, what to change)",
  "specificEdits": ["array of specific changes (optional)"]
}
```

**Response (Success)**
```json
{
  "success": true,
  "workflowId": "content-001",
  "refinement": {
    "content": {
      "title": "Refined title",
      "body": "Refined content",
      "summary": "Updated summary",
      "callToAction": "Updated CTA",
      "metadata": {
        "wordCount": 1300,
        "readTime": 6
      }
    },
    "changesApplied": [
      "Made intro more conversational",
      "Added personal anecdote",
      "Shortened conclusion"
    ]
  },
  "durationMs": 12000
}
```

---

## Orchestration

### POST /api/orchestrate

Create an orchestration session and analyze intent.

**Request Body**
```json
{
  "sessionId": "string (required)",
  "intent": "string (required, min 10 chars)",
  "context": {
    "focus": "engineering | marketing | support | general (optional)",
    "urgency": "high | normal | low (optional)",
    "constraints": "string (optional)",
    "projectPath": "string (optional)"
  }
}
```

**Response**
```json
{
  "success": true,
  "session": {
    "sessionId": "session-001",
    "interpretation": {
      "understood": "What the orchestrator understood",
      "reasoning": "Why these tasks were generated",
      "tasks": [
        {
          "id": "task-1705888000000-0",
          "type": "bugfix | content | analysis | review",
          "priority": "high | medium | low",
          "title": "Task title",
          "description": "What this task does",
          "parameters": {
            "title": "...",
            "description": "...",
            "format": "blog_post"
          },
          "status": "pending"
        }
      ],
      "warnings": ["Any concerns about ambiguity"]
    },
    "execution": {
      "total": 2,
      "completed": 0,
      "failed": 0,
      "pending": 2,
      "running": 0
    },
    "createdAt": "2026-01-22T00:00:00.000Z"
  }
}
```

### GET /api/orchestrate/:sessionId

Get orchestration session status.

**Response**
```json
{
  "success": true,
  "session": {
    "sessionId": "session-001",
    "intent": "Original intent",
    "interpretation": { /* as above */ },
    "execution": {
      "total": 2,
      "completed": 1,
      "failed": 0,
      "pending": 0,
      "running": 1
    },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### GET /api/orchestrate

List all orchestration sessions.

**Response**
```json
{
  "success": true,
  "count": 3,
  "sessions": [
    {
      "sessionId": "session-001",
      "intent": "First 100 chars of intent...",
      "execution": { /* counts */ },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### POST /api/orchestrate/:sessionId/execute

Dispatch all pending tasks in a session.

**Response**
```json
{
  "success": true,
  "dispatched": 2,
  "failed": 0,
  "execution": {
    "total": 2,
    "completed": 0,
    "failed": 0,
    "pending": 0,
    "running": 2
  }
}
```

### PATCH /api/orchestrate/:sessionId/tasks/:taskId

Update a specific task status (used by workflow callbacks).

**Request Body**
```json
{
  "status": "running | completed | failed",
  "result": { /* task result */ },
  "error": "error message if failed"
}
```

**Response**
```json
{
  "success": true,
  "execution": { /* updated counts */ }
}
```

---

## Mandrel Integration

### POST /api/mandrel/bugfix/:id/complete

Store bug fix completion to Mandrel.

**Request Body**
```json
{
  "bugReport": { /* BugReport object */ },
  "analysis": { /* BugAnalysis object */ },
  "review": {
    "decision": "approved | rejected | changes_requested",
    "feedback": "optional feedback"
  }
}
```

**Response**
```json
{
  "success": true,
  "workflowId": "bug-001",
  "message": "Stored to Mandrel"
}
```

### POST /api/mandrel/content/:id/complete

Store content completion to Mandrel.

**Request Body**
```json
{
  "brief": { /* ContentBrief object */ },
  "generation": { /* ContentGenerationResult object */ },
  "review": {
    "decision": "approved | rejected | needs_revision",
    "feedback": "optional feedback"
  }
}
```

**Response**
```json
{
  "success": true,
  "workflowId": "content-001",
  "message": "Stored to Mandrel"
}
```

### POST /api/mandrel/search

Search Mandrel for relevant context.

**Request Body**
```json
{
  "query": "string (required)",
  "type": "code | decision | error | planning | completion | milestone (optional)",
  "limit": 5
}
```

**Response**
```json
{
  "success": true,
  "query": "login authentication",
  "count": 3,
  "contexts": [
    {
      "id": "uuid",
      "content": "Context content...",
      "type": "completion",
      "tags": ["workflow", "bugfix"],
      "createdAt": "..."
    }
  ]
}
```

### GET /api/mandrel/recent

Get recent workflow completions.

**Query Parameters**
- `limit` (optional, default 10): Number of results

**Response**
```json
{
  "success": true,
  "count": 5,
  "workflows": [
    {
      "id": "uuid",
      "content": "WORKFLOW COMPLETION: ...",
      "type": "completion",
      "tags": ["workflow", "bugfix", "produce"],
      "createdAt": "..."
    }
  ]
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "details": [
    {
      "code": "validation_error",
      "message": "Field is required",
      "path": ["field", "name"]
    }
  ]
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `MANDREL_URL` | https://mandrel.ridgetopai.net/mcp/tools | Mandrel API base URL |

---

## Type Definitions

### Severity
```typescript
type Severity = 'blocker' | 'major' | 'minor';
```

### Confidence
```typescript
type Confidence = 'high' | 'medium' | 'low';
```

### ContentFormat
```typescript
type ContentFormat =
  | 'blog_post'
  | 'tweet_thread'
  | 'documentation'
  | 'email'
  | 'announcement'
  | 'case_study';
```

### AudienceType
```typescript
type AudienceType = 'developers' | 'business' | 'general' | 'internal';
```

### ContentTone
```typescript
type ContentTone = 'professional' | 'conversational' | 'technical' | 'educational';
```

### TaskType
```typescript
type TaskType = 'bugfix' | 'content' | 'support' | 'analysis' | 'review';
```

### Priority
```typescript
type Priority = 'high' | 'medium' | 'low';
```

### OrchTaskStatus
```typescript
type OrchTaskStatus = 'pending' | 'dispatched' | 'running' | 'completed' | 'failed';
```
