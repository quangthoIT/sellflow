import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

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
}
