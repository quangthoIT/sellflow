import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function customersRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      return await db.customer.findMany({ orderBy: { createdAt: 'desc' } });
    } catch (err) {
      return [];
    }
  });

  const saveCustomer = async (request: any, reply: any) => {
    const data = request.body as any;
    const paramId = (request.params as any)?.id;
    const id = paramId || data.id || `KH_${Date.now()}`;

    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.tax !== undefined) updateData.tax = data.tax;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.representative !== undefined) updateData.representative = data.representative;
      if (data.note !== undefined) updateData.note = data.note;

      const customer = await db.customer.upsert({
        where: { id },
        update: updateData,
        create: {
          id,
          name: data.name || 'Khách hàng mới',
          phone: data.phone || '',
          email: data.email || '',
          tax: data.tax || '',
          address: data.address || '',
          representative: data.representative || '',
          note: data.note || '',
        },
      });

      return { success: true, customer };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  };

  fastify.post('/', saveCustomer);
  fastify.put('/:id', saveCustomer);
  fastify.patch('/:id', saveCustomer);

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.customer.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
