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

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `KH_${Date.now()}`;
      const customerData = {
        name: data.name,
        phone: data.phone || '',
        email: data.email || '',
        tax: data.tax || '',
        address: data.address || '',
        representative: data.representative || '',
        note: data.note || '',
      };

      const customer = await db.customer.upsert({
        where: { id },
        update: customerData,
        create: { id, ...customerData },
      });

      return { success: true, customer };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

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
