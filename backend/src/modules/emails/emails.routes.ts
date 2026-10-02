import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { emailService } from '../../services/email.service.js';

export async function emailsRoutes(fastify: FastifyInstance) {
  fastify.get('/logs', async () => {
    try {
      return await db.emailLog.findMany({ orderBy: { sentAt: 'desc' } });
    } catch (err) {
      return [];
    }
  });

  fastify.post('/send', async (request, reply) => {
    const { recipient, subject, body } = request.body as any;
    try {
      const log = await db.emailLog.create({
        data: { recipient, subject, status: 'sent' },
      });
      return { success: true, log };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.post('/send-otp', async (request, reply) => {
    const { email, otp, smtpOptions } = request.body as any;
    if (!email || !otp) {
      return reply.status(400).send({ success: false, message: 'Thiếu email hoặc mã OTP' });
    }

    try {
      await emailService.sendOtpEmail(email, otp, smtpOptions);
      try {
        await db.emailLog.create({
          data: {
            recipient: email,
            subject: `[SellFlow] Mã xác thực OTP khôi phục mật khẩu: ${otp}`,
            status: 'sent',
          },
        });
      } catch {
        // ignore log error
      }
      return { success: true, message: 'Đã gửi mã OTP qua email thành công' };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Lỗi gửi email' });
    }
  });
}
