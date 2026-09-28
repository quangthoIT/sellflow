import { FastifyInstance } from 'fastify';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    if (email === 'admin@sellflow.com' && password === '123456') {
      const token = fastify.jwt.sign({ id: 'u1', email, role: 'ADMIN' });
      return { success: true, token, user: { id: 'u1', name: 'System Admin', email, role: 'ADMIN' } };
    }
    return reply.status(401).send({ success: false, message: 'Invalid credentials' });
  });

  fastify.get('/me', async (request, reply) => {
    return { user: { id: 'u1', name: 'System Admin', email: 'admin@sellflow.com', role: 'ADMIN' } };
  });
}
