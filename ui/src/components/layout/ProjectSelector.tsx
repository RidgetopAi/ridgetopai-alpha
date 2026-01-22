import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Folder, Check, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store';

export function ProjectSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    currentProject,
    projects,
    isLoading,
    error,
    fetchProjects,
    fetchCurrentProject,
    setCurrentProject,
    clearError,
  } = useProjectStore();

  // Fetch projects and current project on mount
  useEffect(() => {
    fetchCurrentProject();
    fetchProjects();
  }, [fetchCurrentProject, fetchProjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle project selection
  const handleSelectProject = async (projectName: string) => {
    if (projectName === currentProject?.name) {
      setIsOpen(false);
      return;
    }

    const success = await setCurrentProject(projectName);
    if (success) {
      setIsOpen(false);
    }
  };

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-2 py-1 rounded-md
          text-sm transition-colors duration-150
          hover:bg-surface-2
          ${isOpen ? 'bg-surface-2' : ''}
          ${error ? 'border border-status-error' : ''}
        `}
      >
        <span className="text-text-secondary">Project:</span>
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-text-secondary animate-spin" />
        ) : (
          <>
            <span className="text-text-primary font-medium max-w-[150px] truncate">
              {currentProject?.name || 'Select...'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-text-tertiary transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 z-50 rounded-lg shadow-lg border border-border-subtle bg-surface-1 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border-subtle bg-surface-2">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Mandrel Projects
            </span>
          </div>

          {/* Project List */}
          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 && !isLoading ? (
              <div className="px-3 py-4 text-center text-text-tertiary text-sm">
                No projects found
              </div>
            ) : (
              projects.map((project) => {
                const isSelected = project.name === currentProject?.name;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.name)}
                    className={`
                      w-full px-3 py-2 flex items-center gap-3
                      text-left transition-colors duration-100
                      ${isSelected ? 'bg-surface-3' : 'hover:bg-surface-2'}
                    `}
                  >
                    <Folder
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-accent-primary' : 'text-text-tertiary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm truncate ${
                          isSelected ? 'text-accent-primary font-medium' : 'text-text-primary'
                        }`}
                      >
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="text-xs text-text-tertiary truncate">
                          {project.description}
                        </div>
                      )}
                      {project.contextCount !== undefined && (
                        <div className="text-xs text-text-tertiary">
                          {project.contextCount} contexts
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-3 py-2 bg-status-error/10 border-t border-status-error/20">
              <span className="text-xs text-status-error">{error}</span>
            </div>
          )}

          {/* Footer with refresh */}
          <div className="px-3 py-2 border-t border-border-subtle bg-surface-2">
            <button
              onClick={() => {
                fetchProjects();
                fetchCurrentProject();
              }}
              disabled={isLoading}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {isLoading ? 'Refreshing...' : 'Refresh projects'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
