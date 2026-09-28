import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } });
      return products.map(p => ({ ...p, cost: p.cost.toString(), price: p.price.toString() }));
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `SP_${Date.now()}`;
      const productData = {
        name: data.name,
        category: data.category || '',
        unit: data.unit || 'cái',
        cost: BigInt(data.cost || 0),
        price: BigInt(data.price || 0),
        stock: data.stock !== undefined ? Number(data.stock) : 0,
        minStock: data.minStock !== undefined ? Number(data.minStock) : 0,
        description: data.description || '',
        status: data.status || 'Đang bán',
      };

      const product = await db.product.upsert({
        where: { id },
        update: productData,
        create: { id, ...productData },
      });

      return { success: true, product: { ...product, cost: product.cost.toString(), price: product.price.toString() } };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.product.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
