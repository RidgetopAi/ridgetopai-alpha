/**
 * Project Types - Mandrel Project Management
 */

export interface MandrelProject {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'paused';
  contextCount?: number;
  lastUpdated?: string;
  createdAt?: string;
}

export interface ProjectListResponse {
  success: boolean;
  projects: MandrelProject[];
  error?: string;
}

export interface ProjectCurrentResponse {
  success: boolean;
  project?: MandrelProject;
  error?: string;
}

export interface ProjectSwitchResponse {
  success: boolean;
  project?: MandrelProject;
  error?: string;
}
