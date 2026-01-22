import { create } from 'zustand';
import type { Command, CommandResult, CommandError, CommandStatus } from '../lib/types';

interface CommandStore {
  commands: Command[];
  activeCommand: Command | null;
  queue: Command[];

  // Actions
  addCommand: (description: string) => string;
  updateCommand: (id: string, update: Partial<Command>) => void;
  updateStatus: (id: string, status: CommandStatus) => void;
  startCommand: (id: string) => void;
  completeCommand: (id: string, result: CommandResult) => void;
  failCommand: (id: string, error: CommandError) => void;
  cancelCommand: (id: string) => void;
  getCommand: (id: string) => Command | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useCommandStore = create<CommandStore>((set, get) => ({
  commands: [],
  activeCommand: null,
  queue: [],

  addCommand: (description) => {
    const id = generateId();
    const command: Command = {
      id,
      description,
      status: 'pending',
      createdAt: new Date(),
    };

    set((state) => ({
      commands: [...state.commands, command],
      queue: [...state.queue, command],
    }));

    return id;
  },

  updateCommand: (id, update) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id ? { ...cmd, ...update } : cmd
      ),
      queue: state.queue.map((cmd) =>
        cmd.id === id ? { ...cmd, ...update } : cmd
      ),
      activeCommand:
        state.activeCommand?.id === id
          ? { ...state.activeCommand, ...update }
          : state.activeCommand,
    }));
  },

  updateStatus: (id, status) => {
    get().updateCommand(id, { status });
  },

  startCommand: (id) => {
    const command = get().commands.find((cmd) => cmd.id === id);
    if (!command) return;

    set((state) => ({
      activeCommand: { ...command, status: 'active', startedAt: new Date() },
      queue: state.queue.filter((cmd) => cmd.id !== id),
      commands: state.commands.map((cmd) =>
        cmd.id === id ? { ...cmd, status: 'active', startedAt: new Date() } : cmd
      ),
    }));
  },

  completeCommand: (id, result) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id
          ? { ...cmd, status: 'complete', completedAt: new Date(), result }
          : cmd
      ),
      activeCommand:
        state.activeCommand?.id === id ? null : state.activeCommand,
    }));
  },

  failCommand: (id, error) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id
          ? { ...cmd, status: 'error', completedAt: new Date(), error }
          : cmd
      ),
      activeCommand:
        state.activeCommand?.id === id ? null : state.activeCommand,
    }));
  },

  cancelCommand: (id) => {
    set((state) => ({
      commands: state.commands.filter((cmd) => cmd.id !== id),
      queue: state.queue.filter((cmd) => cmd.id !== id),
      activeCommand:
        state.activeCommand?.id === id ? null : state.activeCommand,
    }));
  },

  getCommand: (id) => {
    return get().commands.find((cmd) => cmd.id === id);
  },
}));
