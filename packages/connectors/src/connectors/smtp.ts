/**
 * SMTP Email Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class SMTPConnector extends BaseConnector {
  constructor() {
    super({
      name: 'smtp',
      display_name: 'SMTP Email',
      description: 'Send emails via SMTP',
      category: 'communication',
      icon: 'email',
      auth: {
        type: 'api_key',
        instructions: 'Provide SMTP host, port, username, and password',
      },
      base_url: '',
      operations: [
        {
          name: 'send',
          description: 'Send an email',
          required_params: ['to', 'from', 'subject'],
          optional_params: ['html', 'text', 'attachments'],
          param_schema: {
            to: { type: 'string', description: 'Recipient email(s)', required: true },
            from: { type: 'string', description: 'Sender email', required: true },
            subject: { type: 'string', description: 'Email subject', required: true },
            html: { type: 'string', description: 'HTML body' },
            text: { type: 'string', description: 'Plain text body' },
            attachments: { type: 'array', description: 'File attachments' },
          },
          output_schema: {
            message_id: { type: 'string', description: 'Message ID' },
            status: { type: 'string', description: 'Send status' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    // SMTP uses nodemailer-style configuration
    if (!this.credentials.host || !this.credentials.user || !this.credentials.pass) {
      throw new Error('SMTP host, user, and password are required');
    }
  }

  protected async verifyAuth(): Promise<boolean> {
    // For SMTP, we assume valid if credentials are present
    return !!this.credentials.host && !!this.credentials.user && !!this.credentials.pass;
  }

  async call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult> {
    this.validateParams(operation, params);

    try {
      if (operation === 'send') {
        const result = await this.sendEmail(params);
        return {
          success: true,
          data: result,
        };
      }

      throw new Error(`Unknown operation: ${operation}`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  private async sendEmail(params: {
    to: string | string[];
    from: string;
    subject: string;
    html?: string;
    text?: string;
    attachments?: any[];
  }) {
    // Note: In production, use nodemailer
    // For now, return a mock response
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({...});

    const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    // Simulate email sending
    console.log(`[SMTP] Sending email to: ${recipients}`);
    console.log(`[SMTP] Subject: ${params.subject}`);

    return {
      message_id: `<${Date.now()}@uwg-engine>`,
      status: 'sent',
      recipients,
    };
  }
}
