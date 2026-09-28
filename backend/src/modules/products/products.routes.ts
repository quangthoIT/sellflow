import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } });
      return products.map(p => ({
        ...p,
        cost: p.cost.toString(),
        price: p.price.toString(),
        min_stock: p.minStock,
      }));
    } catch (err) {
      return [];
    }
  });

  const saveProduct = async (request: any, reply: any) => {
    const data = request.body as any;
    const paramId = (request.params as any)?.id;
    const id = paramId || data.id || `SP_${Date.now()}`;

    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.cost !== undefined) updateData.cost = BigInt(data.cost);
      if (data.price !== undefined) updateData.price = BigInt(data.price);
      if (data.stock !== undefined) updateData.stock = Number(data.stock);
      if (data.minStock !== undefined) updateData.minStock = Number(data.minStock);
      if (data.min_stock !== undefined) updateData.minStock = Number(data.min_stock);
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;

      const product = await db.product.upsert({
        where: { id },
        update: updateData,
        create: {
          id,
          name: data.name || 'Sản phẩm mới',
          category: data.category || '',
          unit: data.unit || 'cái',
          cost: BigInt(data.cost || 0),
          price: BigInt(data.price || 0),
          stock: data.stock !== undefined ? Number(data.stock) : 0,
          minStock: data.minStock !== undefined ? Number(data.minStock) : (data.min_stock !== undefined ? Number(data.min_stock) : 0),
          description: data.description || '',
          status: data.status || 'Đang bán',
        },
      });

      return {
        success: true,
        product: {
          ...product,
          cost: product.cost.toString(),
          price: product.price.toString(),
          min_stock: product.minStock,
        },
      };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  };

  fastify.post('/', saveProduct);
  fastify.put('/:id', saveProduct);
  fastify.patch('/:id', saveProduct);

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
