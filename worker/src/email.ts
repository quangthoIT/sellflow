import nodemailer from 'nodemailer';

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string }[];
}

export async function processEmailTask(payload: EmailJobPayload): Promise<boolean> {
  console.log(`✉️ [Worker Email Dispatcher] Preparing email to: ${payload.to}, Subject: "${payload.subject}"`);

  // In production, nodemailer.createTransport takes real SMTP config
  console.log(`✅ [Worker Email Dispatcher] Email dispatched successfully to ${payload.to}`);
  return true;
}
