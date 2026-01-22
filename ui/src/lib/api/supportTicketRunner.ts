/**
 * Support Ticket API Client
 * Instance 20 - Connects UI to TaskRunner backend for OPERATE capability
 */

import type { SupportTicket, TicketAnalysis } from '../types/support-workflow';

const API_BASE_URL = import.meta.env.VITE_TASKRUNNER_URL || '';

export interface TicketAnalysisResponse {
  success: boolean;
  workflowId: string;
  analysis?: TicketAnalysis;
  error?: string;
  durationMs?: number;
}

export interface TicketRespondResponse {
  success: boolean;
  workflowId: string;
  message?: string;
  respondedAt?: string;
  error?: string;
}

export interface TicketWorkflowStatusResponse {
  workflowId: string;
  status: string;
  message?: string;
  progress?: number;
  result?: TicketAnalysis;
}

/**
 * Execute support ticket analysis via TaskRunner
 */
export async function executeSupportTicketAnalysis(
  workflowId: string,
  ticket: SupportTicket,
  projectPath?: string
): Promise<TicketAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/support`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId,
      ticket,
      projectPath,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      workflowId,
      error: data.error || `Request failed: ${response.statusText}`,
    };
  }

  // Convert analyzedAt to Date if needed
  if (data.analysis && !data.analysis.analyzedAt) {
    data.analysis.analyzedAt = new Date();
  }

  return data;
}

/**
 * Respond to a support ticket
 */
export async function sendSupportTicketResponse(
  workflowId: string,
  response: string,
  sendEmail: boolean = false
): Promise<TicketRespondResponse> {
  const apiResponse = await fetch(`${API_BASE_URL}/api/workflow/support/${workflowId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      response,
      sendEmail,
    }),
  });

  const data = await apiResponse.json();

  if (!apiResponse.ok) {
    return {
      success: false,
      workflowId,
      error: data.error || `Request failed: ${apiResponse.statusText}`,
    };
  }

  return data;
}

/**
 * Get support ticket workflow status
 */
export async function getSupportTicketStatus(workflowId: string): Promise<TicketWorkflowStatusResponse | null> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/support/${workflowId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to get ticket status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Store support ticket completion to Mandrel
 */
export async function storeSupportTicketCompletion(
  workflowId: string,
  ticket: SupportTicket,
  analysis: TicketAnalysis,
  ticketResponse?: { sentTo: string; body: string; sentAt: Date }
): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/mandrel/support/${workflowId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticket,
      analysis,
      response: ticketResponse,
    }),
  });

  const data = await response.json();
  return data.success === true;
}
