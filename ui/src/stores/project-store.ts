import { create } from 'zustand';
import type { MandrelProject } from '../lib/types/project';
import {
  getProjectList,
  getCurrentProject,
  switchProject,
} from '../lib/api/projectApi';

interface ProjectStore {
  // State
  currentProject: MandrelProject | null;
  projects: MandrelProject[];
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchCurrentProject: () => Promise<void>;
  setCurrentProject: (projectNameOrId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  projects: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });

    const response = await getProjectList();

    if (response.success) {
      set({
        projects: response.projects,
        isLoading: false,
        lastFetched: new Date(),
      });
    } else {
      set({
        isLoading: false,
        error: response.error || 'Failed to fetch projects',
      });
    }
  },

  fetchCurrentProject: async () => {
    set({ isLoading: true, error: null });

    const response = await getCurrentProject();

    if (response.success && response.project) {
      set({
        currentProject: response.project,
        isLoading: false,
      });
    } else {
      set({
        isLoading: false,
        error: response.error || 'No current project',
      });
    }
  },

  setCurrentProject: async (projectNameOrId: string) => {
    const { projects } = get();

    set({ isLoading: true, error: null });

    const response = await switchProject(projectNameOrId);

    if (response.success && response.project) {
      // Update current project
      set({
        currentProject: response.project,
        isLoading: false,
      });

      // If we don't have this project in our list, add it
      const existingProject = projects.find(
        (p) => p.id === response.project!.id || p.name === response.project!.name
      );
      if (!existingProject) {
        set({ projects: [...projects, response.project] });
      }

      return true;
    } else {
      set({
        isLoading: false,
        error: response.error || 'Failed to switch project',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
