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

  const handleTransaction = async (request: any, reply: any) => {
    const data = request.body as any;
    try {
      const productId = data.productId || data.product_id;
      const transaction = await db.inventoryTransaction.create({
        data: {
          id: data.id || `TX_${Date.now()}`,
          productId: productId,
          type: data.type, // 'Nhập kho' | 'Xuất kho' | 'Điều chỉnh'
          qty: Number(data.qty),
          ref: data.ref || '',
          note: data.note || '',
        },
      });

      // Update stock based on transaction type
      if (productId) {
        let stockChange = 0;
        const absQty = Math.abs(Number(data.qty));
        switch (data.type) {
          case 'Nhập kho':
          case 'Hoàn kho':
            stockChange = absQty;
            break;
          case 'Xuất kho':
          case 'Hợp đồng':
            stockChange = -absQty;
            break;
          default:
            // 'Điều chỉnh' or others: use qty sign as-is
            stockChange = Number(data.qty);
            break;
        }
        await db.product.update({
          where: { id: productId },
          data: { stock: { increment: stockChange } },
        });
      }

      return { success: true, transaction };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  };

  fastify.post('/', handleTransaction);
  fastify.post('/transaction', handleTransaction);
}
