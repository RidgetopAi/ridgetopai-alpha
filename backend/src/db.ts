/**
 * Database Connection Module
 * PostgreSQL connection for session persistence
 */

import pg from 'pg';
const { Pool } = pg;

// Connection configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ridgetopai',
  user: process.env.DB_USER || 'ridgetopai',
  password: process.env.DB_PASSWORD,
  max: 10, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.log('[DB] Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('[DB] Query error:', { text: text.substring(0, 100), error });
    throw error;
  }
}

/**
 * Get a client for transaction support
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Check if the database is available
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[DB] Connection check failed:', error);
    return false;
  }
}

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
  console.log('[DB] Initializing schema...');

  // Create orchestration_sessions table
  await query(`
    CREATE TABLE IF NOT EXISTS orchestration_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      intent TEXT NOT NULL,
      context JSONB,
      interpretation JSONB NOT NULL,
      execution JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create workflow_status table for individual workflow tracking
  await query(`
    CREATE TABLE IF NOT EXISTS workflow_status (
      workflow_id VARCHAR(255) PRIMARY KEY,
      workflow_type VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      message TEXT,
      progress INTEGER,
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for common queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at
    ON orchestration_sessions(created_at DESC)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_status_type
    ON workflow_status(workflow_type)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_status_created
    ON workflow_status(created_at DESC)
  `);

  // Create scheduled_tasks table for cron-based automation
  await query(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      cron_pattern VARCHAR(100) NOT NULL,
      intent_template TEXT NOT NULL,
      context JSONB,
      auto_dispatch BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      max_retries INTEGER NOT NULL DEFAULT 0,
      timeout INTEGER,
      tags JSONB,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_result VARCHAR(50),
      last_session_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status
    ON scheduled_tasks(status)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run
    ON scheduled_tasks(next_run_at)
    WHERE status = 'active'
  `);

  // Create event_triggers table for webhook-based automation
  await query(`
    CREATE TABLE IF NOT EXISTS event_triggers (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      source VARCHAR(50) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      conditions JSONB,
      intent_template TEXT NOT NULL,
      context_mapping JSONB,
      auto_dispatch BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      tags JSONB,
      webhook_secret VARCHAR(255),
      trigger_count INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TIMESTAMPTZ,
      last_session_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_event_triggers_status
    ON event_triggers(status)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_event_triggers_source
    ON event_triggers(source, event_type)
    WHERE status = 'active'
  `);

  // Create trigger_executions table for audit logging
  await query(`
    CREATE TABLE IF NOT EXISTS trigger_executions (
      id VARCHAR(255) PRIMARY KEY,
      trigger_id VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL,
      session_id VARCHAR(255),
      success BOOLEAN NOT NULL,
      error TEXT,
      event_payload JSONB,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger
    ON trigger_executions(trigger_id, executed_at DESC)
  `);

  console.log('[DB] Schema initialized');
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Connection pool closed');
}

export { pool };
