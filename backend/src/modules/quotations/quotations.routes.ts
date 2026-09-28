import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function quotationsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      const quotes = await db.quote.findMany({
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
      return quotes.map(q => ({
        ...q,
        discount: q.discount.toString(),
        shipping: q.shipping.toString(),
        items: q.items.map(i => ({ ...i, price: i.price.toString(), discount: i.discount.toString() })),
      }));
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `BG${Date.now()}`;
      const quoteData = {
        customerId: data.customerId || data.customer_id,
        date: new Date(data.date || Date.now()),
        status: data.status || 'Nháp',
        discount: BigInt(data.discount || 0),
        vatPct: data.vatPct || data.vat_pct || 0,
        shipping: BigInt(data.shipping || 0),
        notes: data.notes || '',
      };

      await db.quote.upsert({
        where: { id },
        update: quoteData,
        create: { id, ...quoteData },
      });

      if (data.items && Array.isArray(data.items)) {
        await db.quoteItem.deleteMany({ where: { quoteId: id } });
        await db.quoteItem.createMany({
          data: data.items.map((item: any) => ({
            quoteId: id,
            productId: item.productId || item.product_id,
            productName: item.productName || item.product_name || '',
            qty: item.qty || 1,
            price: BigInt(item.price || 0),
            discount: BigInt(item.discount || 0),
          })),
        });
      }

      const updated = await db.quote.findUnique({ where: { id }, include: { items: true } });
      return { success: true, quote: updated };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.quote.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
