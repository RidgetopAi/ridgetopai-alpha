// RidgeTop AI Command Center - Core Types

// Re-export activity types for Spindles-Proxy integration
export * from './activity';

// Re-export workflow types for PRODUCE capability
export * from './workflow';

// Re-export content workflow types for GROW capability
export * from './content-workflow';

export type CommandStatus =
  | 'idle'
  | 'pending'
  | 'active'
  | 'review'
  | 'complete'
  | 'error';

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'waiting'
  | 'error';

export type ViewMode =
  | 'dashboard'
  | 'queue'
  | 'workflow'
  | 'context'
  | 'history';

export interface Command {
  id: string;
  description: string;
  status: CommandStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  agentId?: string;
  context?: ContextAssembly;
  result?: CommandResult;
  error?: CommandError;
}

export interface CommandResult {
  success: boolean;
  summary: string;
  artifacts?: Artifact[];
  decisions?: Decision[];
}

export interface CommandError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestions?: string[];
}

export interface Agent {
  id: string;
  name: string;
  type: 'forge' | 'claude' | 'custom';
  status: AgentStatus;
  currentTask?: string;
  stats: AgentStats;
}

export interface AgentStats {
  tasksCompleted: number;
  averageTime: number;
  successRate: number;
}

export interface ContextSource {
  id: string;
  type: 'file' | 'mandrel' | 'git' | 'api';
  name: string;
  path?: string;
  selected: boolean;
  tokenCount?: number;
}

export interface ContextAssembly {
  id: string;
  sources: ContextSource[];
  totalTokens: number;
  maxTokens: number;
  assembledAt: Date;
}

export interface Decision {
  id: string;
  question: string;
  options: string[];
  selectedOption?: number;
  customResponse?: string;
  decidedAt?: Date;
  decidedBy: 'human' | 'ai';
}

export interface Artifact {
  id: string;
  type: 'file' | 'code' | 'documentation';
  path: string;
  description: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  agentId?: string;
  commandId?: string;
}
