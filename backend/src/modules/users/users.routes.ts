import { FastifyInstance } from 'fastify';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return [
      { id: 'u1', name: 'System Admin', email: 'admin@sellflow.com', role: 'ADMIN' },
      { id: 'u2', name: 'Sales Representative 1', email: 'sales1@sellflow.com', role: 'SALES' },
    ];
  });
}
