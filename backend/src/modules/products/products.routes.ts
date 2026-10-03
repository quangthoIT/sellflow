import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      const products = await db.product.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { createdAt: 'desc' },
      });
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
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

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

      // Check if product exists and belongs to this company
      const existing = await db.product.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      let product;
      if (existing) {
        product = await db.product.update({
          where: { id },
          data: updateData,
        });
      } else {
        product = await db.product.create({
          data: {
            id,
            companyId: tenant.companyId,
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
      }

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
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const res = await db.product.deleteMany({
        where: { id, companyId: tenant.companyId },
      });
      if (res.count === 0) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy sản phẩm của doanh nghiệp này' });
      }
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
