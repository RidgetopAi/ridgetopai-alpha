import { create } from 'zustand';
import type { Agent, AgentStatus, LogEntry } from '../lib/types';

interface AgentStore {
  agents: Agent[];
  agentLogs: Record<string, LogEntry[]>;

  // Actions
  registerAgent: (agent: Omit<Agent, 'stats'>) => void;
  updateAgentStatus: (id: string, status: AgentStatus, currentTask?: string) => void;
  removeAgent: (id: string) => void;
  addLog: (agentId: string, log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: (agentId: string) => void;
  getAgent: (id: string) => Agent | undefined;
  getActiveAgents: () => Agent[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [
    // Default agents for demo
    {
      id: 'forge-main',
      name: 'Forge Orchestrator',
      type: 'forge',
      status: 'idle',
      stats: { tasksCompleted: 0, averageTime: 0, successRate: 100 },
    },
    {
      id: 'claude-primary',
      name: 'Claude Instance',
      type: 'claude',
      status: 'idle',
      stats: { tasksCompleted: 0, averageTime: 0, successRate: 100 },
    },
  ],
  agentLogs: {},

  registerAgent: (agentData) => {
    const agent: Agent = {
      ...agentData,
      stats: { tasksCompleted: 0, averageTime: 0, successRate: 100 },
    };

    set((state) => ({
      agents: [...state.agents, agent],
      agentLogs: { ...state.agentLogs, [agent.id]: [] },
    }));
  },

  updateAgentStatus: (id, status, currentTask) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, status, currentTask } : agent
      ),
    }));
  },

  removeAgent: (id) => {
    set((state) => {
      const { [id]: removed, ...remainingLogs } = state.agentLogs;
      return {
        agents: state.agents.filter((agent) => agent.id !== id),
        agentLogs: remainingLogs,
      };
    });
  },

  addLog: (agentId, log) => {
    const logEntry: LogEntry = {
      ...log,
      id: generateId(),
      timestamp: new Date(),
      agentId,
    };

    set((state) => ({
      agentLogs: {
        ...state.agentLogs,
        [agentId]: [...(state.agentLogs[agentId] || []), logEntry].slice(-100), // Keep last 100 logs
      },
    }));
  },

  clearLogs: (agentId) => {
    set((state) => ({
      agentLogs: { ...state.agentLogs, [agentId]: [] },
    }));
  },

  getAgent: (id) => {
    return get().agents.find((agent) => agent.id === id);
  },

  getActiveAgents: () => {
    return get().agents.filter((agent) => agent.status === 'working');
  },
}));
