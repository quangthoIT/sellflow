import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  // Get all payments
  fastify.get('/', async () => {
    try {
      const payments = await db.payment.findMany({
        include: { contract: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return payments.map(p => ({
        ...p,
        contractId: p.contractId,
        contract_id: p.contractId,
        amount: Number(p.amount),
        date: p.date.toISOString().split('T')[0],
      }));
    } catch (err) {
      return [];
    }
  });

  // Get single payment
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const p = await db.payment.findUnique({
        where: { id },
        include: { contract: { include: { customer: true } } },
      });
      if (!p) return reply.status(404).send({ success: false, message: 'Not found' });
      return {
        ...p,
        contractId: p.contractId,
        contract_id: p.contractId,
        amount: Number(p.amount),
        date: p.date.toISOString().split('T')[0],
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // Upsert payment
  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `PT${Date.now()}`;
      const paymentData = {
        contractId: data.contractId || data.contract_id,
        date: new Date(data.date || Date.now()),
        amount: BigInt(Math.round(Number(data.amount || 0))),
        method: data.method || 'Chuyển khoản',
        note: data.note || '',
      };

      const payment = await db.payment.upsert({
        where: { id },
        update: paymentData,
        create: { id, ...paymentData },
      });

      return {
        success: true,
        payment: {
          ...payment,
          contractId: payment.contractId,
          contract_id: payment.contractId,
          amount: Number(payment.amount),
        },
      };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete payment
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.payment.deleteMany({ where: { OR: [{ id }, { contractId: id }] } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
