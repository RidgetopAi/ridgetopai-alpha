# Integration Bridge: Connecting Command Center UI to Forge/Spindles

**Created by:** Instance 07
**Purpose:** Define exactly how Instance 06's UI connects to existing Forge infrastructure
**Status:** Specification for implementation

---

## Current State Analysis

### What We Have

| Artifact | Location | What It Does |
|----------|----------|--------------|
| Forge orchestrator | `~/projects/forge/` | Spawns CC instances, tracks progress, emits events |
| Spindles-Proxy | `~/projects/forge/spindles-proxy/` | Intercepts API, broadcasts activity via WebSocket |
| Command Center UI | `~/projects/ridgetopai-alpha/ui/` | React dashboard with mock data |
| Ridge-Control | `~/projects/ridge-control/` | Rust TUI that spawns Forge |

### The Gap

The UI has these integration points defined but NOT implemented:
- `forge.startRun(config)` - No such API exists
- `forge.subscribeToEvents()` - Forge emits to stdout, not WebSocket
- WebSocket events - UI expects events Spindles-Proxy doesn't emit

---

## Integration Architecture

### Option A: Browser-Native (Recommended for V1)

```
┌─────────────────────────────────────────────────────────────┐
│                  BROWSER (Command Center UI)                 │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Dashboard    │    │ Agent Grid   │    │ Command      │  │
│  │ View         │    │              │    │ Input        │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │           │
│         └───────────────────┴───────────────────┘           │
│                             │                               │
│                    ┌────────┴────────┐                     │
│                    │  WebSocket      │                     │
│                    │  Client Hook    │                     │
│                    └────────┬────────┘                     │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              │ ws://localhost:8083/activity
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                   SPINDLES-PROXY (port 8082/8083)           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WebSocket Server (8083)                              │   │
│  │ - Broadcasts: thinking, tool_call, tool_result, text │   │
│  │ - Includes: runName, instance from SIRK session      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SIRK Session API                                     │   │
│  │ - POST /sirk/session (set context)                   │   │
│  │ - GET /sirk/session (read context)                   │   │
│  │ - DELETE /sirk/session (clear)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST /v1/messages
                              │ (proxied to Anthropic)
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                   CLAUDE CODE (spawned by Forge)            │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** The UI doesn't need to spawn Forge. It just WATCHES the activity stream.

For V1:
- User starts SIRK run via Ridge-Control (existing)
- UI connects to Spindles-Proxy WebSocket
- UI displays real-time activity
- UI is purely observational

### Option B: Full Web Control (V2+)

Requires new component: **Forge HTTP API**

```
┌─────────────────────────────────────────────────────────────┐
│                  BROWSER (Command Center UI)                 │
│                                                              │
│    Control API         Activity WebSocket                   │
│        │                      │                             │
└────────┼──────────────────────┼─────────────────────────────┘
         │                      │
         │ HTTP                 │ WebSocket
         │                      │
┌────────▼──────────────────────▼─────────────────────────────┐
│               FORGE-API-SERVER (NEW)                         │
│                                                              │
│  ┌────────────────────┐    ┌────────────────────────┐      │
│  │ REST API           │    │ WebSocket Relay        │      │
│  │ POST /runs (start) │    │ (from Spindles-Proxy)  │      │
│  │ GET /runs/:id      │    │                        │      │
│  │ DELETE /runs/:id   │    │                        │      │
│  └─────────┬──────────┘    └────────────────────────┘      │
│            │                                                │
│            │ spawns                                         │
│            ▼                                                │
│  ┌────────────────────┐                                    │
│  │ Forge subprocess   │                                    │
│  └────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## V1 Implementation Specification

### Step 1: WebSocket Client Hook

Create `~/projects/ridgetopai-alpha/ui/src/hooks/useSpindlesStream.ts`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useCommandStore } from '../stores/command-store';
import { useAgentStore } from '../stores/agent-store';

type ActivityMessage =
  | ThinkingActivity
  | ToolCallActivity
  | ToolResultActivity
  | TextActivity
  | ErrorActivity;

interface ThinkingActivity {
  type: 'thinking';
  text: string;
  timestamp: string;
  runName: string;
  instance: number;
}

interface ToolCallActivity {
  type: 'tool_call';
  name: string;
  params: object;
  timestamp: string;
  runName: string;
  instance: number;
}

interface ToolResultActivity {
  type: 'tool_result';
  name: string;
  success: boolean;
  output?: string;
  timestamp: string;
  runName: string;
  instance: number;
}

interface TextActivity {
  type: 'text';
  text: string;
  timestamp: string;
  runName: string;
  instance: number;
}

interface ErrorActivity {
  type: 'error';
  message: string;
  timestamp: string;
  runName: string;
  instance: number;
}

const SPINDLES_WS_URL = 'ws://localhost:8083/activity';

export function useSpindlesStream() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const { addCommandActivity } = useCommandStore();
  const { updateAgentFromActivity } = useAgentStore();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(SPINDLES_WS_URL);

    ws.current.onopen = () => {
      console.log('[spindles] Connected to activity stream');
      // Clear any pending reconnect
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: ActivityMessage = JSON.parse(event.data);
        handleActivity(message);
      } catch (err) {
        console.error('[spindles] Failed to parse message:', err);
      }
    };

    ws.current.onclose = () => {
      console.log('[spindles] Connection closed, reconnecting in 3s...');
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('[spindles] WebSocket error:', error);
    };
  }, []);

  const handleActivity = (activity: ActivityMessage) => {
    // Map activity to UI stores
    switch (activity.type) {
      case 'thinking':
        addCommandActivity({
          type: 'thinking',
          content: activity.text,
          runName: activity.runName,
          instance: activity.instance,
          timestamp: activity.timestamp,
        });
        break;

      case 'tool_call':
        addCommandActivity({
          type: 'tool_call',
          toolName: activity.name,
          params: activity.params,
          runName: activity.runName,
          instance: activity.instance,
          timestamp: activity.timestamp,
        });
        break;

      case 'tool_result':
        addCommandActivity({
          type: 'tool_result',
          toolName: activity.name,
          success: activity.success,
          output: activity.output,
          runName: activity.runName,
          instance: activity.instance,
          timestamp: activity.timestamp,
        });
        break;

      case 'text':
        addCommandActivity({
          type: 'text',
          content: activity.text,
          runName: activity.runName,
          instance: activity.instance,
          timestamp: activity.timestamp,
        });
        break;

      case 'error':
        addCommandActivity({
          type: 'error',
          message: activity.message,
          runName: activity.runName,
          instance: activity.instance,
          timestamp: activity.timestamp,
        });
        break;
    }

    // Update agent status based on activity
    updateAgentFromActivity({
      runName: activity.runName,
      instance: activity.instance,
      lastActivity: activity.type,
      timestamp: activity.timestamp,
    });
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    ws.current?.close();
    ws.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected: ws.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
    disconnect,
  };
}
```

### Step 2: Store Updates

Update `command-store.ts` to handle activity:

```typescript
// Add to CommandStore interface
interface CommandActivity {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error';
  runName: string;
  instance: number;
  timestamp: string;
  content?: string;
  toolName?: string;
  params?: object;
  success?: boolean;
  output?: string;
  message?: string;
}

interface CommandStore {
  // ... existing fields
  activities: CommandActivity[];

  // ... existing actions
  addCommandActivity: (activity: Omit<CommandActivity, 'id'>) => void;
  clearActivities: () => void;
}
```

### Step 3: Activity Stream Component

Create `~/projects/ridgetopai-alpha/ui/src/components/dashboard/ActivityStream.tsx`:

```typescript
import { useCommandStore } from '../../stores/command-store';

export function ActivityStream() {
  const activities = useCommandStore(state => state.activities);

  return (
    <div className="flex flex-col h-full bg-surface-1 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-surface-3">
        <h3 className="text-sm font-medium text-text-secondary">
          Activity Stream
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activities.map(activity => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}

        {activities.length === 0 && (
          <div className="text-center text-text-tertiary py-8">
            No activity yet. Start a SIRK run to see activity.
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: CommandActivity }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'thinking': return '💭';
      case 'tool_call': return '🔧';
      case 'tool_result': return activity.success ? '✅' : '❌';
      case 'text': return '💬';
      case 'error': return '⚠️';
    }
  };

  const getContent = () => {
    switch (activity.type) {
      case 'thinking':
        return <span className="italic text-text-secondary">{activity.content}</span>;
      case 'tool_call':
        return <span>Called <code className="text-accent-primary">{activity.toolName}</code></span>;
      case 'tool_result':
        return <span>{activity.toolName}: {activity.output?.slice(0, 100)}...</span>;
      case 'text':
        return <span>{activity.content}</span>;
      case 'error':
        return <span className="text-status-error">{activity.message}</span>;
    }
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-surface-2 hover:bg-surface-3">
      <span className="flex-shrink-0">{getIcon()}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1">
          <span>{activity.runName}</span>
          <span>•</span>
          <span>Instance {activity.instance}</span>
          <span>•</span>
          <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="text-sm text-text-primary break-words">
          {getContent()}
        </div>
      </div>
    </div>
  );
}
```

---

## Verification Checklist

Before implementing, verify:

1. **Spindles-Proxy is running:**
   ```bash
   curl http://localhost:8082/health
   ```

2. **WebSocket server is accepting connections:**
   ```bash
   # Using wscat (npm i -g wscat)
   wscat -c ws://localhost:8083/activity
   ```

3. **Activity messages are being broadcast:**
   Start a SIRK run and observe WebSocket output

---

## Future V2 Enhancements

### Forge HTTP API Server

New package: `~/projects/forge/api-server/`

Endpoints:
- `POST /api/runs` - Start new SIRK run
- `GET /api/runs` - List all runs
- `GET /api/runs/:id` - Get run status
- `DELETE /api/runs/:id` - Stop/cancel run
- `GET /api/runs/:id/events` - SSE stream of Forge events

This would allow the Command Center UI to CONTROL runs, not just observe them.

### SIRK Session Display

Query current SIRK session:
```bash
curl http://localhost:8082/sirk/session
```

Display in UI header:
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 ridgetopai-alpha | Instance 7/20 | Running 12m      │
└─────────────────────────────────────────────────────────┘
```

---

## Summary: What Instance 08+ Should Do

**For Immediate Implementation:**
1. Create `useSpindlesStream` hook (code above)
2. Update command-store to handle activities
3. Create ActivityStream component
4. Wire into DashboardView

**For Testing:**
1. Start Spindles-Proxy
2. Start a SIRK run (via Ridge-Control or manual Forge)
3. Open Command Center UI
4. Verify activity appears in real-time

**For V2:**
1. Build Forge API Server
2. Add run controls to UI
3. Full SIRK management from browser

---

*Instance 07 - Integration Bridge Specification*
*Bridges the gap between Instance 06's UI and existing Forge infrastructure*
