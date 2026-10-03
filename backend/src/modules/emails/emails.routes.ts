import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { emailService } from '../../services/email.service.js';
import { requireTenantContext, getTenantContext } from '../../utils/tenant.js';

export async function emailsRoutes(fastify: FastifyInstance) {
  fastify.get('/logs', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      return await db.emailLog.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { sentAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  });

  fastify.post('/send', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { recipient, subject, body } = request.body as any;
    try {
      const log = await db.emailLog.create({
        data: {
          companyId: tenant.companyId,
          recipient,
          subject,
          status: 'sent',
        },
      });
      return { success: true, log };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.post('/send-otp', async (request, reply) => {
    const tenant = await getTenantContext(request);
    const { email, otp, smtpOptions } = request.body as any;
    if (!email || !otp) {
      return reply.status(400).send({ success: false, message: 'Thiếu email hoặc mã OTP' });
    }

    try {
      await emailService.sendOtpEmail(email, otp, smtpOptions);
      if (tenant?.companyId) {
        try {
          await db.emailLog.create({
            data: {
              companyId: tenant.companyId,
              recipient: email,
              subject: `[SellFlow] Mã xác thực OTP khôi phục mật khẩu: ${otp}`,
              status: 'sent',
            },
          });
        } catch {
          // ignore log error
        }
      }
      return { success: true, message: 'Đã gửi mã OTP qua email thành công' };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Lỗi gửi email' });
    }
  });
}
