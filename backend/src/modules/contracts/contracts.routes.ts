import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function contractsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      const contracts = await db.contract.findMany({
        include: { customer: true, items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });
      return contracts.map(c => ({
        ...c,
        items: c.items.map(i => ({ ...i, price: i.price.toString() })),
        payments: c.payments.map(p => ({ ...p, amount: p.amount.toString() })),
      }));
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `HD${Date.now()}`;
      const contractData = {
        quoteId: data.quoteId || data.quote_id || null,
        customerId: data.customerId || data.customer_id,
        date: new Date(data.date || Date.now()),
        status: data.status || 'Nháp',
        stockApplied: data.stockApplied ?? data.stock_applied ?? false,
        notes: data.notes || '',
      };

      await db.contract.upsert({
        where: { id },
        update: contractData,
        create: { id, ...contractData },
      });

      if (data.items && Array.isArray(data.items)) {
        await db.contractItem.deleteMany({ where: { contractId: id } });
        await db.contractItem.createMany({
          data: data.items.map((item: any) => ({
            contractId: id,
            productId: item.productId || item.product_id,
            productName: item.productName || item.product_name || '',
            qty: item.qty || 1,
            price: BigInt(item.price || 0),
          })),
        });
      }

      const updated = await db.contract.findUnique({ where: { id }, include: { items: true } });
      return { success: true, contract: updated };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.contract.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
