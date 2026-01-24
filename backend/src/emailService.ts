/**
 * EmailService - Send emails via SMTP using Nodemailer
 * Instance 4 - Support Ticket Email Sending
 *
 * Configuration via environment variables:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP port (default: 587)
 * - SMTP_SECURE: Use TLS (default: false for port 587)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - EMAIL_FROM_ADDRESS: From email address
 * - EMAIL_FROM_NAME: From name (default: "RidgeTop AI Support")
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Read configuration from environment
function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;

  // If essential config is missing, email is not configured
  if (!host || !user || !pass || !fromAddress) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user,
    pass,
    fromAddress,
    fromName: process.env.EMAIL_FROM_NAME || 'RidgeTop AI Support',
  };
}

// Cached transporter instance
let transporter: Transporter | null = null;

/**
 * Get or create the Nodemailer transporter
 */
function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfig();
  if (!config) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return transporter;
}

/**
 * Check if email sending is available (configured)
 */
export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null;
}

/**
 * Send an email
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, body, replyTo } = params;
  const config = getEmailConfig();

  if (!config) {
    console.warn('[EmailService] Email not configured - missing SMTP environment variables');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const transport = getTransporter();
  if (!transport) {
    return {
      success: false,
      error: 'Failed to create email transport',
    };
  }

  const fromField = `"${config.fromName}" <${config.fromAddress}>`;

  console.log(`[EmailService] Sending email to: ${to}`);
  console.log(`[EmailService] Subject: ${subject}`);

  try {
    const info = await transport.sendMail({
      from: fromField,
      to,
      subject,
      text: body,
      html: formatEmailBodyAsHtml(body),
      replyTo: replyTo || config.fromAddress,
    });

    console.log(`[EmailService] Email sent successfully. MessageId: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailService] Failed to send email: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send a support ticket response email
 */
export async function sendSupportResponse(
  customerEmail: string,
  customerName: string | undefined,
  ticketTitle: string,
  responseBody: string,
  workflowId: string
): Promise<SendEmailResult> {
  const greeting = customerName ? `Dear ${customerName}` : 'Hello';
  const subject = `Re: ${ticketTitle} [Ticket #${workflowId.slice(0, 8)}]`;

  const body = `${greeting},

${responseBody}

---
This is an automated response from RidgeTop AI Support.
Ticket Reference: ${workflowId}

If you have further questions, please reply to this email.`;

  return sendEmail({
    to: customerEmail,
    subject,
    body,
    replyTo: process.env.SUPPORT_REPLY_TO || undefined,
  });
}

/**
 * Convert plain text body to simple HTML
 */
function formatEmailBodyAsHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks and wrap in basic HTML
  const withBreaks = escaped.replace(/\n/g, '<br>\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    hr {
      border: none;
      border-top: 1px solid #eee;
      margin: 20px 0;
    }
  </style>
</head>
<body>
${withBreaks}
</body>
</html>`;
}

/**
 * Verify SMTP connection (useful for health checks)
 */
export async function verifyEmailConnection(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    return false;
  }

  try {
    await transport.verify();
    console.log('[EmailService] SMTP connection verified');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailService] SMTP verification failed: ${errorMessage}`);
    return false;
  }
}
