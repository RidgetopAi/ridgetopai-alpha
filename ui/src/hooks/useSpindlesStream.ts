import { useEffect, useRef, useCallback } from 'react';
import { useActivityStore } from '../stores/activity-store';
import type { WebSocketMessage, ActivityMessage } from '../lib/types/activity';

// Spindles-Proxy WebSocket config (from ~/projects/forge/spindles-proxy/src/config.ts)
const SPINDLES_WS_URL = import.meta.env.VITE_SPINDLES_WS_URL ?? 'ws://localhost:8083/spindles';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface UseSpindlesStreamOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Enable console logging (default: false) */
  debug?: boolean;
}

export function useSpindlesStream(options: UseSpindlesStreamOptions = {}) {
  const { autoConnect = true, debug = false } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const { addActivity, setConnected, setConnectionError, clearActivities } = useActivityStore();

  const log = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[spindles] ${message}`, ...args);
      }
    },
    [debug]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.type === 'connection_ack') {
          log('Connection acknowledged');
          return;
        }

        // All other messages are ActivityMessages
        addActivity(message as ActivityMessage);
        log(`Activity: ${message.type}`, message);
      } catch (err) {
        console.error('[spindles] Failed to parse message:', err);
      }
    },
    [addActivity, log]
  );

  const connect = useCallback(() => {
    // Don't reconnect if already open or connecting
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    log(`Connecting to ${SPINDLES_WS_URL}...`);
    setConnectionError(null);

    try {
      ws.current = new WebSocket(SPINDLES_WS_URL);

      ws.current.onopen = () => {
        log('Connected');
        setConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;

        if (reconnectTimeout.current !== null) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      };

      ws.current.onmessage = handleMessage;

      ws.current.onclose = (event) => {
        log(`Connection closed: ${event.code} ${event.reason}`);
        setConnected(false);
        ws.current = null;

        // Attempt reconnection unless explicitly closed
        if (event.code !== 1000 && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttempts.current, 3); // Max 9s backoff
          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeout.current = setTimeout(connect, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        }
      };

      ws.current.onerror = (error) => {
        console.error('[spindles] WebSocket error:', error);
        setConnectionError('Connection error');
      };
    } catch (err) {
      console.error('[spindles] Failed to create WebSocket:', err);
      setConnectionError('Failed to create connection');
    }
  }, [handleMessage, setConnected, setConnectionError, log]);

  const disconnect = useCallback(() => {
    log('Disconnecting...');

    if (reconnectTimeout.current !== null) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect

    if (ws.current) {
      ws.current.close(1000, 'Client disconnect');
      ws.current = null;
    }

    setConnected(false);
  }, [setConnected, log]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Return control functions and state accessor
  const isConnected = useActivityStore((state) => state.isConnected);
  const connectionError = useActivityStore((state) => state.connectionError);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    clearActivities,
  };
}
