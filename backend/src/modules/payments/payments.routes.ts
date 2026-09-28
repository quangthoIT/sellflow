import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      const payments = await db.payment.findMany({
        include: { contract: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return payments.map(p => ({ ...p, amount: p.amount.toString() }));
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `PT${Date.now()}`;
      const paymentData = {
        contractId: data.contractId || data.contract_id,
        date: new Date(data.date || Date.now()),
        amount: BigInt(data.amount || 0),
        method: data.method || 'Chuyển khoản',
        note: data.note || '',
      };

      const payment = await db.payment.upsert({
        where: { id },
        update: paymentData,
        create: { id, ...paymentData },
      });

      return { success: true, payment: { ...payment, amount: payment.amount.toString() } };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.payment.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
