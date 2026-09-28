import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', async () => {
    try {
      const productCount = await db.product.count();
      const customerCount = await db.customer.count();
      const quoteCount = await db.quote.count();
      const contractCount = await db.contract.count();

      return {
        productCount,
        customerCount,
        quoteCount,
        contractCount,
        monthlyRevenue: 154000000,
        pendingPayments: 45000000,
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
