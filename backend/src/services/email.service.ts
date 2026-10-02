import nodemailer from 'nodemailer';

export interface SmtpOptions {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  senderName?: string;
}

export class EmailService {
  async sendEmail(
    to: string,
    subject: string,
    bodyHtml: string,
    attachments: { filename: string; content?: any; path?: string }[] = [],
    smtpOptions?: SmtpOptions
  ): Promise<boolean> {
    const host = smtpOptions?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = smtpOptions?.port || Number(process.env.SMTP_PORT || 587);
    const user = smtpOptions?.user || process.env.SMTP_USER;
    const pass = smtpOptions?.pass || process.env.SMTP_PASS;
    const senderName = smtpOptions?.senderName || 'SellFlow Support';

    console.log(`[EmailService] Preparing email dispatch to: ${to}, Subject: "${subject}"`);

    if (user && pass) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        });

        await transporter.sendMail({
          from: `"${senderName}" <${user}>`,
          to,
          subject,
          html: bodyHtml,
          attachments,
        });

        console.log(`[EmailService] Email dispatched successfully via SMTP (${user}) to ${to}`);
        return true;
      } catch (err: any) {
        console.error(`[EmailService] SMTP Dispatch Failed:`, err.message);
        throw err;
      }
    } else {
      console.warn(`[EmailService] No SMTP credentials provided. Logged email for simulation.`);
      return true;
    }
  }

  async sendOtpEmail(to: string, otp: string, smtpOptions?: SmtpOptions): Promise<boolean> {
    const subject = `[SellFlow] Mã xác thực OTP khôi phục mật khẩu: ${otp}`;
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Khôi phục mật khẩu SellFlow</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 6px;">Yêu cầu đặt lại mật khẩu cho tài khoản ${to}</p>
        </div>
        
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="color: #475569; font-size: 13px; margin: 0 0 10px 0; font-weight: 500;">Mã xác thực OTP của bạn là:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; font-family: monospace;">${otp}</div>
          <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">Mã có hiệu lực trong vòng <strong>5 phút</strong>. Không chia sẻ mã này cho bất kỳ ai.</p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin-top: 20px;">
          Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ quản trị viên để được hỗ trợ bảo mật.
        </p>
        
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} SellFlow Management System. All rights reserved.
        </p>
      </div>
    `;

    return this.sendEmail(to, subject, html, [], smtpOptions);
  }
}

export const emailService = new EmailService();
