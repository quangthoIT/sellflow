import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      const users = await db.user.findMany({
        where: { companyId: tenant.companyId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return users;
    } catch {
      return [];
    }
  });
}
