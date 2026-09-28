import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      return await db.inventoryTransaction.findMany({
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  });

  fastify.post('/transaction', async (request, reply) => {
    const data = request.body as any;
    try {
      const transaction = await db.inventoryTransaction.create({
        data: {
          id: data.id || `TX_${Date.now()}`,
          productId: data.productId,
          type: data.type, // 'Nhập kho' | 'Xuất kho' | 'Điều chỉnh'
          qty: data.qty,
          ref: data.ref || '',
          note: data.note || '',
        },
      });

      // Update stock
      const stockChange = data.type === 'Nhập kho' ? data.qty : -data.qty;
      await db.product.update({
        where: { id: data.productId },
        data: { stock: { increment: stockChange } },
      });

      return { success: true, transaction };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
