/**
 * SupportTicketForm - Form for creating support tickets
 * Instance 20 - OPERATE capability
 * Instance 10 (bugfix-run) - Added Mandrel project selector
 */

import { useState, useEffect } from 'react';
import type { SupportTicket, TicketSeverity, TicketCategory } from '../../lib/types/support-workflow';
import { CATEGORY_LABELS, SEVERITY_LABELS } from '../../lib/types/support-workflow';
import type { MandrelProject } from '../../lib/types/project';
import { useSupportTicketStore } from '../../stores/support-ticket-store';
import { getProjectList } from '../../lib/api/projectApi';

interface SupportTicketFormProps {
  onSubmit: (workflowId: string) => void;
}

export function SupportTicketForm({ onSubmit }: SupportTicketFormProps) {
  const { createWorkflow, submitWorkflow } = useSupportTicketStore();

  const [ticket, setTicket] = useState<SupportTicket>({
    title: '',
    description: '',
    customerEmail: '',
    customerName: '',
    category: 'bug_report',
    severity: 'medium',
    affectedFeature: '',
    errorMessage: '',
    stepsToReproduce: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mandrel project selector state
  const [mandrelProjects, setMandrelProjects] = useState<MandrelProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Fetch Mandrel projects on mount
  useEffect(() => {
    async function fetchProjects() {
      setProjectsLoading(true);
      const response = await getProjectList();
      if (response.success && response.projects) {
        setMandrelProjects(response.projects);
        // Default to ridgetopai-alpha if available
        const defaultProject = response.projects.find(p => p.name === 'ridgetopai-alpha');
        if (defaultProject) {
          setSelectedProject(defaultProject.name);
        } else if (response.projects.length > 0) {
          setSelectedProject(response.projects[0].name);
        }
      }
      setProjectsLoading(false);
    }
    fetchProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticket.title.trim() || !ticket.description.trim() || !ticket.customerEmail.trim()) {
      return;
    }

    setIsSubmitting(true);

    // Create the workflow
    const workflowId = createWorkflow(ticket);

    // Submit for analysis with Mandrel project
    await submitWorkflow(workflowId, selectedProject || undefined);

    onSubmit(workflowId);
    setIsSubmitting(false);
  };

  const categories = Object.entries(CATEGORY_LABELS) as [TicketCategory, string][];
  const severities = Object.entries(SEVERITY_LABELS) as [TicketSeverity, string][];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mandrel Project */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Mandrel Project <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          disabled={projectsLoading}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
          required
        >
          {projectsLoading ? (
            <option value="">Loading projects...</option>
          ) : mandrelProjects.length === 0 ? (
            <option value="">No projects found</option>
          ) : (
            mandrelProjects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.name} {project.contextCount !== undefined && `(${project.contextCount} contexts)`}
              </option>
            ))
          )}
        </select>
        <p className="text-xs text-gray-500 mt-1">Ticket data will be stored to this Mandrel project</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Ticket Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={ticket.title}
          onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
          placeholder="Brief summary of the issue"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          required
        />
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Customer Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={ticket.customerEmail}
            onChange={(e) => setTicket({ ...ticket, customerEmail: e.target.value })}
            placeholder="customer@example.com"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Customer Name
          </label>
          <input
            type="text"
            value={ticket.customerName}
            onChange={(e) => setTicket({ ...ticket, customerName: e.target.value })}
            placeholder="John Doe"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category and Severity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Category
          </label>
          <select
            value={ticket.category}
            onChange={(e) => setTicket({ ...ticket, category: e.target.value as TicketCategory })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={ticket.severity}
            onChange={(e) => setTicket({ ...ticket, severity: e.target.value as TicketSeverity })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            {severities.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={ticket.description}
          onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
          placeholder="Detailed description of the customer's issue..."
          rows={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          required
        />
      </div>

      {/* Optional Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Affected Feature
          </label>
          <input
            type="text"
            value={ticket.affectedFeature}
            onChange={(e) => setTicket({ ...ticket, affectedFeature: e.target.value })}
            placeholder="e.g., Login, Dashboard, API"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Error Message
          </label>
          <input
            type="text"
            value={ticket.errorMessage}
            onChange={(e) => setTicket({ ...ticket, errorMessage: e.target.value })}
            placeholder="Any error messages the customer reported"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Steps to Reproduce
          </label>
          <textarea
            value={ticket.stepsToReproduce}
            onChange={(e) => setTicket({ ...ticket, stepsToReproduce: e.target.value })}
            placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !ticket.title.trim() || !ticket.description.trim() || !ticket.customerEmail.trim() || !selectedProject}
        className={`
          w-full px-4 py-2 rounded-md font-medium transition-colors
          ${isSubmitting || !ticket.title.trim() || !ticket.description.trim() || !ticket.customerEmail.trim() || !selectedProject
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-cyan-600 text-white hover:bg-cyan-500'
          }
        `}
      >
        {isSubmitting ? 'Analyzing Ticket...' : 'Analyze Ticket'}
      </button>
    </form>
  );
}
