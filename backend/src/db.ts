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

  // Initialize Strategic Layer schema
  await initializeStrategicSchema();

  console.log('[DB] Schema initialized');
}

/**
 * Initialize Strategic Layer database schema
 * Phase 1: Observation Layer
 * Phase 2: Pattern Detection
 * Phase 3: Goal Management
 * Phase 4: Recommendation Engine
 */
async function initializeStrategicSchema(): Promise<void> {
  console.log('[DB] Initializing Strategic Layer schema...');

  // ============================================
  // TABLE 1: pattern_observations (Phase 1)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS pattern_observations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      observation_type VARCHAR(50) NOT NULL DEFAULT 'workflow_completion',
      source_workflow VARCHAR(50) NOT NULL,
      source_capability VARCHAR(20) NOT NULL,
      payload JSONB NOT NULL,
      outcome VARCHAR(50) NOT NULL,
      confidence_score FLOAT CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
      duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for pattern_observations
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_workflow ON pattern_observations(source_workflow)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_outcome ON pattern_observations(outcome)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_observed_at ON pattern_observations(observed_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_workflow_time ON pattern_observations(source_workflow, observed_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_tags ON pattern_observations USING GIN(tags)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_payload ON pattern_observations USING GIN(payload)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_obs_capability ON pattern_observations(source_capability)`);

  // ============================================
  // TABLE 2: patterns (Phase 2)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN ('recurring_success', 'recurring_failure', 'timing_pattern', 'correlation', 'trend')),
      name VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      observation_ids UUID[] DEFAULT ARRAY[]::UUID[],
      observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
      confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      first_observed TIMESTAMPTZ NOT NULL,
      last_observed TIMESTAMPTZ NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'dismissed')),
      dismissed_reason TEXT,
      ai_analysis TEXT,
      ai_recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for patterns
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_status ON patterns(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_created ON patterns(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_observation_ids ON patterns USING GIN(observation_ids)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_patterns_status_confidence ON patterns(status, confidence DESC) WHERE status = 'active'`);

  // ============================================
  // TABLE 3: pattern_analysis_runs (Phase 2 Audit)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS pattern_analysis_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      observations_analyzed INTEGER NOT NULL DEFAULT 0,
      patterns_detected INTEGER NOT NULL DEFAULT 0,
      patterns_updated INTEGER NOT NULL DEFAULT 0,
      config JSONB,
      analysis_time_ms INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  // Indexes for pattern_analysis_runs
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_runs_started ON pattern_analysis_runs(started_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pattern_runs_status ON pattern_analysis_runs(status)`);

  // ============================================
  // TABLE 4: goals (Phase 3)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) NOT NULL CHECK (category IN ('revenue', 'product', 'operational', 'growth', 'technical')),
      priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      target_metric VARCHAR(100),
      target_value FLOAT,
      current_value FLOAT DEFAULT 0,
      progress_percentage FLOAT NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      target_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
      completed_at TIMESTAMPTZ,
      created_by VARCHAR(100) NOT NULL DEFAULT 'brian',
      parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
      related_pattern_ids UUID[] DEFAULT ARRAY[]::UUID[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for goals
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_updated_at ON goals(updated_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date) WHERE target_date IS NOT NULL AND status = 'active'`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_status_category ON goals(status, category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_goals_patterns ON goals USING GIN(related_pattern_ids)`);

  // ============================================
  // TABLE 5: feedback (Phase 4 - before recommendations due to FK)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('recommendation', 'pattern', 'goal')),
      entity_id UUID NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('accept', 'reject', 'defer')),
      feedback_text TEXT,
      feedback_rating INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
      created_by VARCHAR(100) NOT NULL DEFAULT 'brian',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for feedback
  await query(`CREATE INDEX IF NOT EXISTS idx_feedback_entity ON feedback(entity_type, entity_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback(action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC)`);

  // ============================================
  // TABLE 6: recommendations (Phase 4)
  // ============================================
  await query(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('action', 'optimization', 'warning', 'opportunity')),
      priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      source_pattern_ids UUID[] DEFAULT ARRAY[]::UUID[],
      related_goal_ids UUID[] DEFAULT ARRAY[]::UUID[],
      suggested_intent TEXT NOT NULL,
      confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'deferred', 'expired')),
      accepted_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      deferred_until TIMESTAMPTZ,
      feedback_id UUID REFERENCES feedback(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);

  // Indexes for recommendations
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON recommendations(expires_at) WHERE status = 'pending'`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendations(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_patterns ON recommendations USING GIN(source_pattern_ids)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_goals ON recommendations USING GIN(related_goal_ids)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_recommendations_pending_priority ON recommendations(priority, created_at DESC) WHERE status = 'pending'`);

  console.log('[DB] Strategic Layer schema initialized');
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Connection pool closed');
}

export { pool };
