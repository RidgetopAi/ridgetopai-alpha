-- Strategic Layer Database Schema
-- Version: 1.0
-- Created by: SIRK Implementation Run Instance 1
-- Date: 2026-01-23
--
-- Tables (in creation order due to dependencies):
-- 1. pattern_observations - Phase 1: Observation Layer
-- 2. patterns - Phase 2: Pattern Detection
-- 3. pattern_analysis_runs - Phase 2: Audit table for pattern analysis
-- 4. goals - Phase 3: Goal Management
-- 5. feedback - Phase 4: User feedback on recommendations (created before recommendations due to FK)
-- 6. recommendations - Phase 4: Recommendation Engine

-- ============================================
-- TABLE 1: pattern_observations
-- Phase 1: Observation Layer
-- Stores all workflow completions for pattern analysis
-- ============================================

CREATE TABLE IF NOT EXISTS pattern_observations (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Observation classification
  observation_type VARCHAR(50) NOT NULL DEFAULT 'workflow_completion',
  -- Values: workflow_completion, context_stored, user_action

  -- Source workflow identification
  source_workflow VARCHAR(50) NOT NULL,
  -- Values: bugfix, content, support, monitoring, orchestrator

  source_capability VARCHAR(20) NOT NULL,
  -- Values: PRODUCE, GROW, OPERATE, COMMAND

  -- Full observation data as JSONB for flexibility
  payload JSONB NOT NULL,

  -- Workflow outcome
  outcome VARCHAR(50) NOT NULL,
  -- Values: success, failure, partial

  -- Numeric metrics (nullable, not all workflows report)
  confidence_score FLOAT CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  -- Range: 0.0 to 1.0

  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  -- Execution time in milliseconds

  -- Searchable tags (uses GIN index)
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Timestamps
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for pattern_observations
CREATE INDEX IF NOT EXISTS idx_pattern_obs_workflow
  ON pattern_observations(source_workflow);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_outcome
  ON pattern_observations(outcome);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_observed_at
  ON pattern_observations(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_workflow_time
  ON pattern_observations(source_workflow, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_tags
  ON pattern_observations USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_payload
  ON pattern_observations USING GIN(payload);

CREATE INDEX IF NOT EXISTS idx_pattern_obs_capability
  ON pattern_observations(source_capability);


-- ============================================
-- TABLE 2: patterns
-- Phase 2: Pattern Detection
-- Stores detected patterns with confidence and AI analysis
-- ============================================

CREATE TABLE IF NOT EXISTS patterns (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern classification
  pattern_type VARCHAR(50) NOT NULL
    CHECK (pattern_type IN ('recurring_success', 'recurring_failure', 'timing_pattern', 'correlation', 'trend')),

  -- Human-readable identification
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- Observation references (array of UUIDs)
  observation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count >= 0),

  -- Confidence and timing
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  first_observed TIMESTAMPTZ NOT NULL,
  last_observed TIMESTAMPTZ NOT NULL,

  -- Status management (soft delete via status)
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'dismissed')),
  dismissed_reason TEXT,

  -- AI-generated content
  ai_analysis TEXT,
  ai_recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for patterns
CREATE INDEX IF NOT EXISTS idx_patterns_type
  ON patterns(pattern_type);

CREATE INDEX IF NOT EXISTS idx_patterns_status
  ON patterns(status);

CREATE INDEX IF NOT EXISTS idx_patterns_confidence
  ON patterns(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_created
  ON patterns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_observation_ids
  ON patterns USING GIN(observation_ids);

CREATE INDEX IF NOT EXISTS idx_patterns_status_confidence
  ON patterns(status, confidence DESC) WHERE status = 'active';


-- ============================================
-- TABLE 3: pattern_analysis_runs
-- Phase 2: Audit table for pattern analysis runs
-- Tracks when pattern analysis was run and results
-- ============================================

CREATE TABLE IF NOT EXISTS pattern_analysis_runs (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Analysis results
  observations_analyzed INTEGER NOT NULL DEFAULT 0,
  patterns_detected INTEGER NOT NULL DEFAULT 0,
  patterns_updated INTEGER NOT NULL DEFAULT 0,

  -- Configuration used
  config JSONB,

  -- Timing
  analysis_time_ms INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  error TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for pattern_analysis_runs
CREATE INDEX IF NOT EXISTS idx_pattern_runs_started
  ON pattern_analysis_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_runs_status
  ON pattern_analysis_runs(status);


-- ============================================
-- TABLE 4: goals
-- Phase 3: Goal Management
-- Stores strategic objectives with progress tracking
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Goal definition
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- Classification
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('revenue', 'product', 'operational', 'growth', 'technical')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Progress tracking
  target_metric VARCHAR(100),
  target_value FLOAT,
  current_value FLOAT DEFAULT 0,
  progress_percentage FLOAT NOT NULL DEFAULT 0
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- Timeline
  target_date DATE,

  -- Status management
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  completed_at TIMESTAMPTZ,

  -- Ownership
  created_by VARCHAR(100) NOT NULL DEFAULT 'brian',

  -- Hierarchy (self-referential for sub-goals)
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

  -- Pattern linking (array of pattern UUIDs)
  related_pattern_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_status
  ON goals(status);

CREATE INDEX IF NOT EXISTS idx_goals_category
  ON goals(category);

CREATE INDEX IF NOT EXISTS idx_goals_priority
  ON goals(priority);

CREATE INDEX IF NOT EXISTS idx_goals_parent
  ON goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_created_at
  ON goals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_updated_at
  ON goals(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_target_date
  ON goals(target_date) WHERE target_date IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_goals_status_category
  ON goals(status, category);

CREATE INDEX IF NOT EXISTS idx_goals_patterns
  ON goals USING GIN(related_pattern_ids);


-- ============================================
-- TABLE 5: feedback
-- Phase 4: User feedback on recommendations, patterns, goals
-- Created BEFORE recommendations due to foreign key constraint
-- ============================================

CREATE TABLE IF NOT EXISTS feedback (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the entity being rated
  entity_type VARCHAR(50) NOT NULL
    CHECK (entity_type IN ('recommendation', 'pattern', 'goal')),
  entity_id UUID NOT NULL,

  -- Action taken
  action VARCHAR(20) NOT NULL
    CHECK (action IN ('accept', 'reject', 'defer')),

  -- Optional feedback details
  feedback_text TEXT,
  feedback_rating INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),

  -- Ownership
  created_by VARCHAR(100) NOT NULL DEFAULT 'brian',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_entity
  ON feedback(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_feedback_action
  ON feedback(action);

CREATE INDEX IF NOT EXISTS idx_feedback_created
  ON feedback(created_at DESC);


-- ============================================
-- TABLE 6: recommendations
-- Phase 4: Recommendation Engine
-- Stores AI-generated recommendations connecting patterns to goals
-- ============================================

CREATE TABLE IF NOT EXISTS recommendations (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recommendation content
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- Classification
  recommendation_type VARCHAR(50) NOT NULL
    CHECK (recommendation_type IN ('action', 'optimization', 'warning', 'opportunity')),
  priority VARCHAR(20) NOT NULL
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Source references (arrays of UUIDs)
  source_pattern_ids UUID[] DEFAULT ARRAY[]::UUID[],
  related_goal_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Suggested action for orchestrator
  suggested_intent TEXT NOT NULL,

  -- Confidence and status
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'deferred', 'expired')),

  -- Action timestamps
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  deferred_until TIMESTAMPTZ,

  -- Link to feedback
  feedback_id UUID REFERENCES feedback(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Generated column for priority ordering (critical=4, high=3, medium=2, low=1)
-- Note: This uses a GENERATED ALWAYS AS column which requires PostgreSQL 12+
-- If using older PostgreSQL, this can be handled in application code instead

-- Indexes for recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_status
  ON recommendations(status);

CREATE INDEX IF NOT EXISTS idx_recommendations_type
  ON recommendations(recommendation_type);

CREATE INDEX IF NOT EXISTS idx_recommendations_priority
  ON recommendations(priority);

CREATE INDEX IF NOT EXISTS idx_recommendations_expires
  ON recommendations(expires_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_recommendations_created
  ON recommendations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_patterns
  ON recommendations USING GIN(source_pattern_ids);

CREATE INDEX IF NOT EXISTS idx_recommendations_goals
  ON recommendations USING GIN(related_goal_ids);

CREATE INDEX IF NOT EXISTS idx_recommendations_pending_priority
  ON recommendations(priority, created_at DESC) WHERE status = 'pending';


-- ============================================
-- VERIFICATION QUERIES
-- Run these to confirm schema is correct
-- ============================================

-- Check all tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('pattern_observations', 'patterns', 'pattern_analysis_runs', 'goals', 'feedback', 'recommendations');

-- Check indexes for each table:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('pattern_observations', 'patterns', 'pattern_analysis_runs', 'goals', 'feedback', 'recommendations');

-- Check constraints:
-- SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN (
--   'pattern_observations'::regclass, 'patterns'::regclass, 'pattern_analysis_runs'::regclass,
--   'goals'::regclass, 'feedback'::regclass, 'recommendations'::regclass
-- );
