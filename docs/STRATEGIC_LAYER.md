# Strategic Layer Documentation

## Overview

The Strategic Layer is an AI-powered recommendation system that observes workflow completions, detects behavioral patterns, and generates strategic recommendations aligned with Brian's goals. It transforms RidgeTop AI from a reactive task executor into a proactive strategic partner.

## Architecture

The Strategic Layer consists of 4 phases that work together in a continuous feedback loop:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STRATEGIC LAYER CYCLE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: Observation    Phase 2: Detection    Phase 3: Goals          │
│  ┌───────────────┐       ┌───────────────┐     ┌───────────────┐       │
│  │   Workflow    │──────▶│    Pattern    │     │     Goal      │       │
│  │  Completion   │       │   Analysis    │─┐   │  Management   │       │
│  │  Recording    │       │   (Claude)    │ │   │    (CRUD)     │       │
│  └───────────────┘       └───────────────┘ │   └───────────────┘       │
│         │                       │          │          │                 │
│         ▼                       ▼          │          ▼                 │
│  pattern_observations      patterns        │       goals               │
│         table               table          │       table               │
│                                            │                           │
│                    Phase 4: Recommendations                            │
│                    ┌─────────────────────────────────────┐             │
│                    │   patterns + goals = recommendations │◀────────────┘
│                    │          (Claude analysis)           │             │
│                    └─────────────────────────────────────┘             │
│                                  │                                      │
│                                  ▼                                      │
│                          recommendations                                │
│                              table                                      │
│                                  │                                      │
│                                  ▼                                      │
│                    ┌─────────────────────────────────────┐             │
│                    │  Brian accepts recommendation       │             │
│                    │         ▼                           │             │
│                    │  Orchestration session created      │             │
│                    │         ▼                           │             │
│                    │  New workflow executes              │             │
│                    │         ▼                           │             │
│                    │  Back to Phase 1 (Observation)      │─────────────┘
│                    └─────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Tables

### pattern_observations
Records workflow completion events with structured metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| observation_type | VARCHAR(50) | Type: workflow_completion (default) |
| source_workflow | VARCHAR(50) | bugfix, content, support, monitoring |
| source_capability | VARCHAR(20) | PRODUCE, GROW, OPERATE, COMMAND |
| payload | JSONB | Full workflow result data |
| outcome | VARCHAR(50) | success, failure, partial |
| confidence_score | FLOAT | 0.0-1.0 confidence level |
| duration_ms | INTEGER | Workflow execution time |
| tags | TEXT[] | Searchable tags (GIN indexed) |
| observed_at | TIMESTAMPTZ | When the event occurred |
| created_at | TIMESTAMPTZ | Record creation time |

### patterns
AI-detected behavioral patterns from observation analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| pattern_type | VARCHAR(50) | recurring_success, recurring_failure, timing_pattern, correlation, trend |
| name | VARCHAR(200) | Human-readable pattern name |
| description | TEXT | Detailed description |
| observation_ids | UUID[] | Contributing observation IDs |
| observation_count | INTEGER | Number of supporting observations |
| confidence | FLOAT | AI confidence score (0.0-1.0) |
| first_observed | TIMESTAMPTZ | First occurrence |
| last_observed | TIMESTAMPTZ | Most recent occurrence |
| status | VARCHAR(20) | active, superseded, dismissed |
| dismissed_reason | TEXT | Reason if dismissed |
| ai_analysis | TEXT | Claude's analysis |
| ai_recommendations | TEXT[] | Claude's suggestions |
| created_at | TIMESTAMPTZ | Record creation time |
| updated_at | TIMESTAMPTZ | Last update time |

### pattern_analysis_runs
Audit table tracking pattern analysis executions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| observations_analyzed | INTEGER | Count of observations processed |
| patterns_detected | INTEGER | New patterns found |
| patterns_updated | INTEGER | Existing patterns updated |
| config | JSONB | Analysis configuration used |
| analysis_time_ms | INTEGER | Processing duration |
| status | VARCHAR(20) | running, completed, failed |
| error | TEXT | Error message if failed |
| started_at | TIMESTAMPTZ | Analysis start time |
| completed_at | TIMESTAMPTZ | Analysis completion time |

### goals
Strategic objectives that Brian wants to achieve.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| title | VARCHAR(200) | Goal title |
| description | TEXT | Detailed description |
| category | VARCHAR(50) | revenue, product, operational, growth, technical |
| priority | VARCHAR(20) | critical, high, medium, low |
| target_metric | VARCHAR(100) | Metric being measured |
| target_value | FLOAT | Target metric value |
| current_value | FLOAT | Current metric value |
| progress_percentage | FLOAT | Progress 0-100 |
| target_date | DATE | Goal deadline |
| status | VARCHAR(20) | active, completed, paused, abandoned |
| completed_at | TIMESTAMPTZ | Completion timestamp |
| created_by | VARCHAR(100) | Creator (default: brian) |
| parent_goal_id | UUID | Parent goal for hierarchy |
| related_pattern_ids | UUID[] | Linked patterns |
| created_at | TIMESTAMPTZ | Record creation time |
| updated_at | TIMESTAMPTZ | Last update time |

### recommendations
AI-generated strategic suggestions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| source_pattern_id | UUID | Pattern that triggered this |
| linked_goal_id | UUID | Goal this supports (optional) |
| type | VARCHAR(50) | workflow, goal_adjustment, process_improvement, resource_allocation |
| priority | VARCHAR(20) | urgent, high, medium, low |
| title | VARCHAR(200) | Recommendation title |
| description | TEXT | Detailed explanation |
| suggested_intent | TEXT | Intent for orchestration |
| expected_impact | JSONB | Predicted outcomes |
| ai_rationale | TEXT | Claude's reasoning |
| confidence | FLOAT | AI confidence (0.0-1.0) |
| status | VARCHAR(20) | pending, accepted, rejected, deferred, expired |
| feedback_id | UUID | Link to user feedback |
| expires_at | TIMESTAMPTZ | Recommendation expiry (7 days default) |
| created_at | TIMESTAMPTZ | Record creation time |
| updated_at | TIMESTAMPTZ | Last update time |

### feedback
User responses to recommendations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| entity_type | VARCHAR(50) | Entity type (recommendation) |
| entity_id | UUID | Entity ID |
| feedback_type | VARCHAR(50) | accept, reject, defer |
| comment | TEXT | User comments |
| created_by | VARCHAR(100) | User (default: brian) |
| created_at | TIMESTAMPTZ | Record creation time |

## API Endpoints

### Goals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/strategic/goals` | GET | List goals with filtering |
| `/api/strategic/goals/stats` | GET | Get goal statistics |
| `/api/strategic/goals/hierarchy` | GET | Get goal tree structure |
| `/api/strategic/goals/:id` | GET | Get single goal |
| `/api/strategic/goals` | POST | Create new goal |
| `/api/strategic/goals/:id` | PATCH | Update goal |
| `/api/strategic/goals/:id/progress` | PATCH | Update progress |
| `/api/strategic/goals/:id` | DELETE | Abandon goal |
| `/api/strategic/goals/:goalId/patterns/:patternId` | POST | Link pattern |
| `/api/strategic/goals/:goalId/patterns/:patternId` | DELETE | Unlink pattern |

### Patterns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/strategic/patterns` | GET | List patterns with filtering |
| `/api/strategic/patterns/stats` | GET | Get pattern statistics |
| `/api/strategic/patterns/runs` | GET | Get analysis run history |
| `/api/strategic/patterns/:id` | GET | Get single pattern |
| `/api/strategic/patterns/analyze` | POST | Trigger manual analysis |
| `/api/strategic/patterns/:id` | PATCH | Update/dismiss pattern |

### Recommendations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/strategic/recommendations` | GET | List recommendations |
| `/api/strategic/recommendations/stats` | GET | Get recommendation stats |
| `/api/strategic/recommendations/pending` | GET | Get pending recommendations |
| `/api/strategic/recommendations/expiring` | GET | Get expiring soon |
| `/api/strategic/recommendations/:id` | GET | Get single recommendation |
| `/api/strategic/recommendations/generate` | POST | Trigger generation |
| `/api/strategic/recommendations/:id/accept` | POST | Accept recommendation |
| `/api/strategic/recommendations/:id/reject` | POST | Reject recommendation |
| `/api/strategic/recommendations/:id/defer` | POST | Defer recommendation |
| `/api/strategic/recommendations/:id/feedback` | GET | Get feedback |
| `/api/strategic/feedback/stats` | GET | Get feedback statistics |

## Scheduled Jobs

Two cron jobs run daily:

1. **Pattern Analysis** - 6:00 AM UTC
   - Analyzes recent observations
   - Detects new patterns
   - Updates existing patterns with new data

2. **Recommendation Generation** - 7:00 AM UTC
   - Analyzes active patterns + active goals
   - Generates relevant recommendations
   - Links recommendations to goals

## Backend Components

### strategicObserver.ts
Records workflow completions as observations.
- `recordObservation(data)` - Core recording function
- `recordBugfixCompletion(result)` - Bugfix workflow handler
- `recordContentCompletion(result)` - Content workflow handler
- `recordTicketCompletion(result)` - Support workflow handler
- `recordAlertCompletion(result)` - Monitoring workflow handler

### patternAnalyzer.ts
Claude-powered pattern detection.
- `analyzePatterns(config)` - Main analysis entry point
- Builds prompts with observation batches
- Parses Claude's JSON response
- Stores/updates patterns in database

### goalManager.ts
Business logic for goal management.
- CRUD operations with validation
- Progress tracking with auto-completion
- Pattern linking
- Mandrel context storage for milestones

### recommendationEngine.ts
Claude-powered recommendation generation.
- `generateRecommendations()` - Main generation entry point
- Combines patterns + goals for Claude analysis
- Creates recommendations with confidence scores
- Triggers after new patterns detected

## UI Components

### Goals View (`/goals`)
- **GoalsPanel** - Main container with stats bar and filtering
- **GoalCard** - Individual goal display with progress bar
- **CreateGoalModal** - Create/edit goal form
- **GoalProgressBar** - Visual progress indicator

### Recommendations View (`/recommendations`)
- **RecommendationsPanel** - Main container with stats and filtering
- **RecommendationCard** - Individual recommendation with actions

## The Full Cycle

1. **Workflow Executes** → Observation recorded in `pattern_observations`
2. **Daily at 6AM** → Pattern analysis runs, patterns stored/updated
3. **Daily at 7AM** → Recommendations generated from patterns + goals
4. **Brian Reviews** → Accepts, rejects, or defers recommendations
5. **On Accept** → Orchestration session created with suggested intent
6. **Orchestration Runs** → New workflow executes
7. **Cycle Repeats** → Back to step 1

## Configuration Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| Analysis window | 30 days | How far back to look for observations |
| Min observations | 10 | Minimum observations needed for pattern detection |
| Min pattern confidence | 0.5 | Threshold for pattern acceptance |
| Max patterns per run | 20 | Limit patterns detected per analysis |
| Recommendation expiry | 7 days | How long before recommendations expire |
| Threshold trigger | 10 observations | Auto-trigger analysis after N new observations |

## VPS Deployment

- **Service**: `systemctl status ridgetopai`
- **Backend path**: `/opt/ridgetopai/backend`
- **UI path**: `/opt/ridgetopai/ui`
- **Web files**: `/var/www/ridgetopai.net`
- **Logs**: `tail -f /var/log/ridgetopai.log`
- **Database**: `ridgetopai` (PostgreSQL)
- **Backend port**: 3002

## Testing the Strategic Layer

```bash
# Test health
curl http://localhost:3002/health

# List goals
curl http://localhost:3002/api/strategic/goals

# Create a goal
curl -X POST http://localhost:3002/api/strategic/goals \
  -H "Content-Type: application/json" \
  -d '{"title":"Increase Revenue","description":"Grow monthly revenue by 20%","category":"revenue","priority":"high"}'

# Trigger pattern analysis
curl -X POST http://localhost:3002/api/strategic/patterns/analyze

# Trigger recommendation generation
curl -X POST http://localhost:3002/api/strategic/recommendations/generate

# View recommendations
curl http://localhost:3002/api/strategic/recommendations
```

## Implementation Notes

### Route Ordering
The `/api/strategic/patterns/runs` route must be defined BEFORE `/api/strategic/patterns/:id` to avoid Express matching "runs" as an ID parameter.

### Fire-and-Forget Observations
Observation recording is async fire-and-forget to avoid blocking workflow completions.

### Pattern Matching
New patterns are compared against existing active patterns. If 30%+ observation overlap is found, the existing pattern is updated rather than creating a duplicate.

### Automatic Goal Completion
When a goal's progress reaches 100%, it is automatically marked as completed.

---

*Documentation created by SIRK Implementation Run Instance 10*
*Date: 2026-01-23*
