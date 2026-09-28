export class EmailService {
  async sendEmail(to: string, subject: string, bodyHtml: string, attachments: string[] = []): Promise<boolean> {
    console.log(`[EmailService] Queueing email dispatch to: ${to} with subject: "${subject}"`);
    return true;
  }
}
