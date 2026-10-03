import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  // Get all payments for company
  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      const payments = await db.payment.findMany({
        where: { companyId: tenant.companyId },
        include: { contract: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return payments.map(p => ({
        ...p,
        contractId: p.contractId,
        contract_id: p.contractId,
        amount: Number(p.amount),
        date: p.date.toISOString().split('T')[0],
      }));
    } catch (err) {
      return [];
    }
  });

  // Get single payment
  fastify.get('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const p = await db.payment.findFirst({
        where: { id, companyId: tenant.companyId },
        include: { contract: { include: { customer: true } } },
      });
      if (!p) return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán' });
      return {
        ...p,
        contractId: p.contractId,
        contract_id: p.contractId,
        amount: Number(p.amount),
        date: p.date.toISOString().split('T')[0],
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // Upsert payment
  fastify.post('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const data = request.body as any;
    try {
      const id = data.id || `PT${Date.now()}`;
      const contractId = data.contractId || data.contract_id;

      // Verify contract belongs to company
      const contract = await db.contract.findFirst({
        where: { id: contractId, companyId: tenant.companyId },
      });
      if (!contract) {
        return reply.status(400).send({ success: false, message: 'Hợp đồng không tồn tại hoặc không thuộc công ty của bạn' });
      }

      const paymentData = {
        companyId: tenant.companyId,
        contractId: contractId,
        date: new Date(data.date || Date.now()),
        amount: BigInt(Math.round(Number(data.amount || 0))),
        method: data.method || 'Chuyển khoản',
        note: data.note || '',
      };

      const existing = await db.payment.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      let payment;
      if (existing) {
        payment = await db.payment.update({
          where: { id },
          data: paymentData,
        });
      } else {
        payment = await db.payment.create({
          data: { id, ...paymentData },
        });
      }

      return {
        success: true,
        payment: {
          ...payment,
          contractId: payment.contractId,
          contract_id: payment.contractId,
          amount: Number(payment.amount),
        },
      };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete payment
  fastify.delete('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const res = await db.payment.deleteMany({
        where: {
          OR: [{ id }, { contractId: id }],
          companyId: tenant.companyId,
        },
      });
      if (res.count === 0) {
        return reply.status(404).send({ success: false, message: 'Không tìm thấy thanh toán cần xóa' });
      }
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
