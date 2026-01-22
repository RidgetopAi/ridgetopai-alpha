# RidgeTop AI - Command Center UI Design

**Created by:** Instance 06
**Purpose:** Define the UI architecture for the solo builder command center
**Status:** Initial design specification

---

## Overview

The Command Center is the primary interface for a solo builder to orchestrate AI-assisted work. It provides visibility into:

1. **Active Commands** - What's currently being executed
2. **Agent Status** - Which AI agents are working, on what
3. **Context Flow** - What context is being gathered and consumed
4. **Workflow Progress** - Where in the workflow each task sits
5. **Decision Points** - Where human judgment is required

The goal: **Enable one human to effectively direct many AI agents**.

---

## Design Philosophy

### Core Principles

1. **Information Radiator** - Show status at a glance, details on demand
2. **Interrupt-Driven** - Only demand attention when human decision needed
3. **Context-Aware** - Show relevant context, hide irrelevant noise
4. **Action-Oriented** - Every view leads to a clear action
5. **Trust-Visible** - Show confidence levels, make verification easy

### Anti-Patterns to Avoid

- ❌ Walls of text (use visual indicators)
- ❌ Constant attention required (interrupt when needed)
- ❌ Hidden state (always show what's happening)
- ❌ Manual polling (real-time updates)
- ❌ Mode confusion (clear indication of current state)

---

## Technology Stack

Based on Brian's existing ecosystem analysis:

```
Framework:     Vite + React 18 + TypeScript
Styling:       Tailwind CSS v4 with custom design tokens
State:         Zustand for global state
Real-time:     Socket.IO for live updates
Visualization: XYFlow for workflow graphs
Animation:     Framer Motion for meaningful transitions
Validation:    Zod for type safety
```

### Why These Choices

| Technology | Rationale |
|------------|-----------|
| Vite | Fast dev experience, used in Surveyor |
| Tailwind | Consistent with Squire/Surveyor, allows custom tokens |
| Zustand | All three Brian projects use it, proven pattern |
| Socket.IO | Real-time updates critical for command status |
| XYFlow | Surveyor uses it, good for workflow visualization |
| Framer Motion | Used in Squire/Surveyor, meaningful motion |

---

## Color System (Design Tokens)

Derived from Squire's salience-based system, adapted for command operations:

```css
/* Surface Hierarchy (Dark theme) */
--surface-0: #0a0a0f;    /* Deepest background */
--surface-1: #12121a;    /* Primary background */
--surface-2: #1a1a24;    /* Elevated surfaces */
--surface-3: #24242e;    /* Hover states */
--surface-4: #2e2e38;    /* Active states */

/* Text Hierarchy */
--text-primary: #f0f0f5;
--text-secondary: #a0a0b0;
--text-tertiary: #606070;
--text-disabled: #404050;

/* Status Colors */
--status-idle: #404050;      /* Gray - nothing happening */
--status-pending: #60a5fa;   /* Blue - queued, waiting */
--status-active: #fbbf24;    /* Gold - in progress */
--status-review: #a855f7;    /* Purple - needs human */
--status-complete: #4ade80;  /* Green - done */
--status-error: #f87171;     /* Red - failed */

/* Accent Colors */
--accent-primary: #00d4ff;   /* Electric cyan - primary actions */
--accent-gold: #ffd700;      /* Gold - important items */
--accent-purple: #9d4edd;    /* Purple - AI/agent related */

/* Semantic Colors */
--human-action: #ffd700;     /* Gold - human needed */
--ai-action: #9d4edd;        /* Purple - AI executing */
--system-action: #60a5fa;    /* Blue - automated */
```

---

## Layout Architecture

### Primary Layout

```
┌────────────────────────────────────────────────────────────────┐
│  HEADER: Project | Status | Quick Actions | Settings           │
├────────────────────────────────────────────────────────────────┤
│         │                                   │                  │
│ SIDEBAR │        MAIN CONTENT AREA          │   DETAIL PANEL   │
│         │                                   │                  │
│ - Tasks │     (varies by active view)       │   (contextual)   │
│ - Agents│                                   │                  │
│ - Context│                                   │                  │
│ - History│                                   │                  │
│         │                                   │                  │
├─────────┴───────────────────────────────────┴──────────────────┤
│  STATUS BAR: Active agents | Queue depth | Time | Mandrel sync │
└────────────────────────────────────────────────────────────────┘
```

### View Modes

1. **Dashboard View** (default) - Overview of all activity
2. **Queue View** - Command queue management
3. **Workflow View** - Visual workflow graph
4. **Context View** - Context gathering and assembly
5. **History View** - Completed work, learnings

---

## Component Architecture

### Core Components

```
components/
├── layout/
│   ├── Header.tsx           # Project selector, status, actions
│   ├── Sidebar.tsx          # Navigation and summary panels
│   ├── DetailPanel.tsx      # Contextual detail display
│   └── StatusBar.tsx        # System status indicators
│
├── dashboard/
│   ├── DashboardView.tsx    # Main dashboard layout
│   ├── ActiveCommands.tsx   # Currently executing commands
│   ├── AgentGrid.tsx        # Agent status grid
│   ├── QuickStats.tsx       # Key metrics at a glance
│   └── RecentActivity.tsx   # Recent completions/decisions
│
├── queue/
│   ├── QueueView.tsx        # Command queue management
│   ├── CommandCard.tsx      # Individual command display
│   ├── CommandForm.tsx      # New command input
│   └── PriorityControls.tsx # Reorder, prioritize commands
│
├── workflow/
│   ├── WorkflowView.tsx     # XYFlow canvas container
│   ├── TaskNode.tsx         # Task node in workflow
│   ├── DependencyEdge.tsx   # Dependency visualization
│   └── WorkflowControls.tsx # Zoom, filter, layout controls
│
├── context/
│   ├── ContextView.tsx      # Context assembly interface
│   ├── ContextSources.tsx   # Available context sources
│   ├── ContextPreview.tsx   # Assembled context preview
│   └── TokenBudget.tsx      # Token usage visualization
│
├── agents/
│   ├── AgentCard.tsx        # Individual agent status
│   ├── AgentLogs.tsx        # Agent activity stream
│   └── AgentConfig.tsx      # Agent configuration
│
├── shared/
│   ├── StatusBadge.tsx      # Reusable status indicator
│   ├── ActionButton.tsx     # Primary action buttons
│   ├── Panel.tsx            # Reusable panel container
│   ├── Toast.tsx            # Notification toasts
│   └── Modal.tsx            # Modal dialogs
│
└── overlays/
    ├── ReviewOverlay.tsx    # Human review required overlay
    ├── ErrorOverlay.tsx     # Error display overlay
    └── ConfirmDialog.tsx    # Confirmation dialogs
```

### State Architecture (Zustand Stores)

```typescript
// stores/command-store.ts
interface CommandStore {
  commands: Command[];
  activeCommand: Command | null;
  queue: Command[];

  // Actions
  addCommand: (cmd: Partial<Command>) => void;
  updateCommand: (id: string, update: Partial<Command>) => void;
  startCommand: (id: string) => void;
  completeCommand: (id: string, result: CommandResult) => void;
  cancelCommand: (id: string) => void;
}

// stores/agent-store.ts
interface AgentStore {
  agents: Agent[];
  activeAgents: string[];
  agentLogs: Record<string, LogEntry[]>;

  // Actions
  registerAgent: (agent: Agent) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  addLog: (agentId: string, log: LogEntry) => void;
}

// stores/context-store.ts
interface ContextStore {
  sources: ContextSource[];
  assembledContext: AssembledContext | null;
  tokenBudget: number;
  tokenUsed: number;

  // Actions
  addSource: (source: ContextSource) => void;
  assembleContext: (taskId: string) => void;
  clearContext: () => void;
}

// stores/ui-store.ts
interface UIStore {
  activeView: 'dashboard' | 'queue' | 'workflow' | 'context' | 'history';
  detailPanelOpen: boolean;
  selectedItem: string | null;
  notifications: Notification[];

  // Actions
  setView: (view: string) => void;
  openDetail: (itemId: string) => void;
  closeDetail: () => void;
  addNotification: (notification: Notification) => void;
}
```

---

## Key User Flows

### Flow 1: Start New Command

```
1. User types command in natural language
2. System extracts entities, suggests context
3. User confirms or adjusts context selection
4. Command enters queue → moves to active
5. Agent(s) begin execution
6. Status updates in real-time
7. If decision needed → interrupt with ReviewOverlay
8. On completion → toast notification + move to history
```

### Flow 2: Human Review Required

```
1. Agent reaches decision point requiring human judgment
2. Current task pauses
3. ReviewOverlay appears with:
   - What decision is needed
   - Relevant context
   - Suggested options
   - Custom input option
4. Human makes decision
5. Agent continues with decision
6. Decision logged to Mandrel
```

### Flow 3: Error Recovery

```
1. Agent encounters error
2. Error logged with full context
3. ErrorOverlay appears with:
   - What failed
   - Why (if known)
   - Recovery options:
     - Retry with same context
     - Retry with different approach
     - Skip and continue
     - Cancel command
4. Human selects action
5. System executes recovery
```

---

## Interaction Patterns

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command input |
| `Cmd/Ctrl + 1-5` | Switch views (dashboard, queue, etc.) |
| `Cmd/Ctrl + Enter` | Approve/continue on review |
| `Esc` | Close detail panel / cancel |
| `Space` | Pause/resume active command |
| `?` | Show keyboard shortcuts |

### Mouse Interactions

- **Click** - Select item, open detail
- **Double-click** - Primary action on item
- **Right-click** - Context menu
- **Drag** - Reorder queue items
- **Hover** - Show quick preview

---

## Real-Time Updates

### WebSocket Events (Socket.IO)

```typescript
// Server → Client
'command:status' - Command status changed
'agent:status' - Agent status changed
'agent:log' - New log entry from agent
'review:required' - Human review needed
'error:occurred' - Error in execution
'context:updated' - Context assembly updated

// Client → Server
'command:start' - Start a command
'command:cancel' - Cancel a command
'review:decision' - Human made decision
'agent:message' - Message to agent
```

### Polling Fallback

If WebSocket unavailable, poll every 2 seconds for:
- Active command status
- Agent status
- Queue updates

---

## Responsive Design

### Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1400px | Full three-panel layout |
| 1024-1399px | Sidebar collapses to icons |
| 768-1023px | Detail panel becomes overlay |
| < 768px | Mobile: single panel with navigation |

### Mobile Considerations

- Swipe gestures for navigation
- Bottom sheet for detail panel
- Simplified queue view
- Focus on status monitoring over management

---

## Accessibility

### Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactions
- Screen reader support with ARIA labels
- Color contrast ratios met
- Focus indicators visible
- Motion reduction support

### Implementation

```typescript
// Motion wrapper respecting user preferences
const motionProps = prefersReducedMotion
  ? {}
  : { initial: {...}, animate: {...}, transition: {...} };
```

---

## Integration Points

### Mandrel Integration

```typescript
// Context operations
mandrel.contextStore(content, type, tags)
mandrel.contextSearch(query, limit)
mandrel.contextGetRecent(limit)

// Task operations
mandrel.taskCreate(task)
mandrel.taskUpdate(id, updates)
mandrel.taskList(filters)

// Decision operations
mandrel.decisionRecord(decision)
mandrel.decisionSearch(query)
```

### Forge Integration

```typescript
// Instance orchestration
forge.startRun(config)
forge.getRunStatus(runId)
forge.sendToInstance(instanceId, message)

// Event streaming
forge.subscribeToEvents(runId, callback)
```

---

## Future Considerations

### Phase 2 Features

- Multi-project dashboard
- Team/collaboration features
- Custom agent configurations
- Advanced workflow templates
- Analytics and reporting

### Phase 3 Features

- Voice command input
- AI-suggested commands
- Predictive context assembly
- Cross-project context sharing
- Learning from decisions

---

## File Structure

```
ridgetopai-alpha/
└── ui/                          # NEW: Command Center UI
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── components/          # As defined above
    │   ├── stores/              # Zustand stores
    │   ├── hooks/               # Custom hooks
    │   ├── lib/
    │   │   ├── api/            # API clients
    │   │   ├── types/          # TypeScript types
    │   │   └── utils/          # Utilities
    │   ├── styles/
    │   │   └── globals.css     # Tailwind + tokens
    │   └── constants/
    └── public/
        └── assets/
```

---

## Implementation Priority

### MVP (First Implementation)

1. **Dashboard View** with:
   - Active command display
   - Agent status grid
   - Quick stats

2. **Command Input** with:
   - Natural language input
   - Basic context selection

3. **Status Updates** with:
   - WebSocket connection
   - Real-time command status

4. **Review Overlay** with:
   - Decision prompt
   - Option selection
   - Custom input

### Post-MVP

- Queue management
- Workflow visualization
- Context assembly UI
- History view
- Full keyboard navigation

---

*Created: Instance 06 of ridgetopai-alpha*
*Purpose: Establish UI architecture before implementation*
*Builds on: Instance 05's workflow, Instance 03's infrastructure analysis*
