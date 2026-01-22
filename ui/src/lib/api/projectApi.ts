/**
 * Project API Client - Mandrel Project Management
 * Communicates with backend to access Mandrel project operations
 */

import type {
  MandrelProject,
  ProjectListResponse,
  ProjectCurrentResponse,
  ProjectSwitchResponse,
} from '../types/project';

// Backend API URL (proxies to Mandrel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Call backend Mandrel proxy endpoint
 */
async function callBackendProxy<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      console.error(`[ProjectAPI] HTTP ${response.status} from ${endpoint}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[ProjectAPI] Failed to call ${endpoint}:`, error);
    return null;
  }
}

/**
 * Parse project from Mandrel response text
 */
function parseProjectFromText(text: string): MandrelProject | null {
  // Look for project details in the response
  // Format: "✅ Switched to project: **name**" or similar
  const nameMatch = text.match(/\*\*([^*]+)\*\*/);
  const descMatch = text.match(/Description:\s*(.+?)(?:\n|$)/i);
  const statusMatch = text.match(/Status:\s*(\w+)/i);
  const contextMatch = text.match(/Contexts?:\s*(\d+)/i);
  const lastUpdatedMatch = text.match(/Last Updated:\s*([^\n]+)/i);

  if (!nameMatch) return null;

  return {
    id: nameMatch[1].toLowerCase().replace(/\s+/g, '-'),
    name: nameMatch[1],
    description: descMatch?.[1]?.trim(),
    status: (statusMatch?.[1]?.toLowerCase() as 'active' | 'archived' | 'paused') || 'active',
    contextCount: contextMatch ? parseInt(contextMatch[1], 10) : undefined,
    lastUpdated: lastUpdatedMatch?.[1]?.trim(),
  };
}

/**
 * Parse project list from Mandrel response text
 */
function parseProjectListFromText(text: string): MandrelProject[] {
  const projects: MandrelProject[] = [];

  // Split by project entries - look for numbered items or project blocks
  const lines = text.split('\n');
  let currentProject: Partial<MandrelProject> | null = null;

  for (const line of lines) {
    // Match project entry patterns like "1. **project-name**" or "- **project-name**"
    const projectMatch = line.match(/(?:^\s*(?:\d+\.|-)\s*)?\*\*([^*]+)\*\*/);
    if (projectMatch) {
      // Save previous project
      if (currentProject?.name) {
        projects.push({
          id: currentProject.id || currentProject.name.toLowerCase().replace(/\s+/g, '-'),
          name: currentProject.name,
          status: currentProject.status || 'active',
          description: currentProject.description,
          contextCount: currentProject.contextCount,
        } as MandrelProject);
      }
      currentProject = {
        name: projectMatch[1],
        id: projectMatch[1].toLowerCase().replace(/\s+/g, '-'),
      };
      continue;
    }

    if (!currentProject) continue;

    // Parse additional fields
    const statusMatch = line.match(/Status:\s*(\w+)/i);
    if (statusMatch) {
      currentProject.status = statusMatch[1].toLowerCase() as 'active' | 'archived' | 'paused';
    }

    const descMatch = line.match(/Description:\s*(.+)/i);
    if (descMatch) {
      currentProject.description = descMatch[1].trim();
    }

    const contextMatch = line.match(/Contexts?:\s*(\d+)/i);
    if (contextMatch) {
      currentProject.contextCount = parseInt(contextMatch[1], 10);
    }

    const idMatch = line.match(/ID:\s*([a-f0-9-]+)/i);
    if (idMatch) {
      currentProject.id = idMatch[1];
    }
  }

  // Don't forget the last project
  if (currentProject?.name) {
    projects.push({
      id: currentProject.id || currentProject.name.toLowerCase().replace(/\s+/g, '-'),
      name: currentProject.name,
      status: currentProject.status || 'active',
      description: currentProject.description,
      contextCount: currentProject.contextCount,
    } as MandrelProject);
  }

  return projects;
}

/**
 * Get list of all projects
 */
export async function getProjectList(): Promise<ProjectListResponse> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/projects/list');

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        projects: [],
        error: response?.error || 'Failed to get project list',
      };
    }

    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const projects = parseProjectListFromText(fullText);

    return {
      success: true,
      projects,
    };
  } catch (error) {
    return {
      success: false,
      projects: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current active project
 */
export async function getCurrentProject(): Promise<ProjectCurrentResponse> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/projects/current');

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        error: response?.error || 'Failed to get current project',
      };
    }

    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const project = parseProjectFromText(fullText);

    if (!project) {
      return {
        success: false,
        error: 'No project currently active',
      };
    }

    return {
      success: true,
      project,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Switch to a different project
 */
export async function switchProject(
  projectNameOrId: string
): Promise<ProjectSwitchResponse> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/projects/switch', {
      method: 'POST',
      body: JSON.stringify({ project: projectNameOrId }),
    });

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        error: response?.error || 'Failed to switch project',
      };
    }

    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const project = parseProjectFromText(fullText);

    if (!project) {
      return {
        success: false,
        error: 'Failed to parse project response',
      };
    }

    return {
      success: true,
      project,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
