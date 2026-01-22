# Instance 08 - Implementation: Connecting UI to Forge

**Instance**: 8 of 20
**Focus**: Implementing Instance 07's integration specification
**Principle**: Design -> Build -> Learn. Instance 07 designed. Instance 08 builds.

---

## What I Did

I implemented the V1 integration that Instance 07 specified, connecting the Command Center UI to Spindles-Proxy WebSocket for real-time SIRK activity streaming.

### Files Created

1. **`src/lib/types/activity.ts`** - Activity types aligned with actual Spindles-Proxy
   - Copied types directly from `~/projects/forge/spindles-proxy/src/types/activity.ts`
   - Added `ActivityRecord` type for UI (with id and receivedAt)
   - Ensures type safety between systems

2. **`src/stores/activity-store.ts`** - Zustand store for activity state
   - Manages list of activities (max 500 to prevent memory bloat)
   - Tracks current SIRK session
   - Tracks connection state and errors

3. **`src/hooks/useSpindlesStream.ts`** - WebSocket connection hook
   - Auto-connects on mount (configurable)
   - Handles reconnection with exponential backoff
   - Parses WebSocket messages and updates activity store
   - Debug mode for development

4. **`src/components/dashboard/ActivityStream.tsx`** - Visual component
   - Displays real-time activity feed
   - Shows connection status indicator
   - Shows current SIRK session badge
   - Auto-scrolls to new activity
   - Clear and Connect/Disconnect controls

### Files Modified

1. **`src/lib/types/index.ts`** - Added re-export of activity types
2. **`src/components/dashboard/DashboardView.tsx`** - Added ActivityStream to layout

---

## Key Decisions

### 1. Separate Activity Store (not merged into command-store)

Instance 07's spec suggested adding to command-store. I chose a separate store because:
- Activities are a different concern than commands
- Activities come from external system (Spindles), commands from user
- Cleaner separation of concerns
- Easier to reason about state

### 2. Direct Type Copy from Spindles-Proxy

Instance 07's spec had slightly different types. I copied directly from source:
- `session.runName` not `runName`
- `session.instanceNumber` not `instance`
- WebSocket path is `/spindles` not `/activity`

This ensures actual compatibility, not assumed compatibility.

### 3. Configurable WebSocket URL

Added `VITE_SPINDLES_WS_URL` env var support for flexibility:
- Default: `ws://localhost:8083/spindles`
- Can be overridden in `.env` for different deployments

### 4. Activity Limit (500)

Limited stored activities to prevent memory issues during long SIRK runs.
500 is enough to see recent history but won't crash browser after hours.

---

## What I Learned

### 1. Types Matter at Boundaries

Instance 07 assumed the WebSocket message format. When I checked the actual source, there were differences. Always verify at system boundaries.

### 2. Building Reveals Integration Issues

The spec looked complete, but implementing it revealed:
- TypeScript strict mode caught type mismatches
- Tailwind v4 `@theme` directive works differently than v3
- Need to handle `unknown` types explicitly in React

### 3. The System Works

Spindles-Proxy is already running (`curl http://localhost:8082/health` returns OK with 1 WebSocket client). The infrastructure Instance 07 documented exists and is operational.

---

## Verification Status

- [x] TypeScript compiles (`npm run build` passes)
- [x] Spindles-Proxy is running
- [x] WebSocket port 8083 is open
- [ ] Full integration test with live SIRK run (not tested - would require starting a run)

---

## What's Next

The UI can now OBSERVE SIRK runs in real-time. What's still missing:

1. **Control capability** (Option B from Instance 07):
   - Start/stop SIRK runs from UI
   - Requires new Forge API server

2. **Agent state sync**:
   - UI's agent-store shows mock agents
   - Should update agents based on activity (which instance is active)

3. **Command correlation**:
   - Connect activities to commands
   - When SIRK run starts, create corresponding command

4. **Session panel**:
   - Dedicated view showing full SIRK session details
   - Progress bar for instance completion

---

## Technical Notes

### WebSocket Message Flow

```
Claude Code → Anthropic API
             ↓ (intercepted)
         Spindles-Proxy (8082)
             ↓ (parsed, broadcast)
         WebSocket Server (8083/spindles)
             ↓
         Command Center UI (useSpindlesStream hook)
             ↓
         activity-store (Zustand)
             ↓
         ActivityStream component (React)
```

### Connection States

1. `Disconnected` - Not connected, click Connect
2. `Connecting` - WebSocket opening
3. `Connected (Live)` - Receiving messages
4. `Error` - Connection failed, shows error message

### Activity Types

| Type | Icon | Description |
|------|------|-------------|
| thinking | T (purple) | Claude's extended thinking |
| tool_call | C (blue) | Tool invocation |
| tool_result | R/E (green/red) | Tool result (success/error) |
| text | $ (gray) | Text output |
| error | ! (red) | Error message |

---

*Instance 08 - Implementation Complete*
*Motto: Specs become real when you type the code.*
