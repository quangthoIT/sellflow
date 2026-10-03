import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function customersRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      return await db.customer.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  });

  const saveCustomer = async (request: any, reply: any) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

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

      const existing = await db.customer.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      let customer;
      if (existing) {
        customer = await db.customer.update({
          where: { id },
          data: updateData,
        });
      } else {
        customer = await db.customer.create({
          data: {
            id,
            companyId: tenant.companyId,
            name: data.name || 'Khách hàng mới',
            phone: data.phone || '',
            email: data.email || '',
            tax: data.tax || '',
            address: data.address || '',
            representative: data.representative || '',
            note: data.note || '',
          },
        });
      }

      return { success: true, customer };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  };

  fastify.post('/', saveCustomer);
  fastify.put('/:id', saveCustomer);
  fastify.patch('/:id', saveCustomer);

  fastify.delete('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const res = await db.customer.deleteMany({
        where: { id, companyId: tenant.companyId },
      });
      if (res.count === 0) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy khách hàng của doanh nghiệp này' });
      }
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
