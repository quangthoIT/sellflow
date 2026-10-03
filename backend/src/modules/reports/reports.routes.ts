import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) {
      return {
        productCount: 0,
        customerCount: 0,
        quoteCount: 0,
        contractCount: 0,
        monthlyRevenue: 0,
        pendingPayments: 0,
      };
    }

    try {
      const [productCount, customerCount, quoteCount, contractCount, paymentsAgg] = await Promise.all([
        db.product.count({ where: { companyId: tenant.companyId } }),
        db.customer.count({ where: { companyId: tenant.companyId } }),
        db.quote.count({ where: { companyId: tenant.companyId } }),
        db.contract.count({ where: { companyId: tenant.companyId } }),
        db.payment.aggregate({
          where: { companyId: tenant.companyId },
          _sum: { amount: true },
        }),
      ]);

      const totalRevenue = paymentsAgg._sum.amount ? Number(paymentsAgg._sum.amount) : 0;

      return {
        productCount,
        customerCount,
        quoteCount,
        contractCount,
        monthlyRevenue: totalRevenue,
        pendingPayments: 0,
      };
    } catch (err) {
      return {
        productCount: 0,
        customerCount: 0,
        quoteCount: 0,
        contractCount: 0,
        monthlyRevenue: 0,
        pendingPayments: 0,
      };
    }
  });
}
