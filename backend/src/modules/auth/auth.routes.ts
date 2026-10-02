import { FastifyInstance } from 'fastify';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@sellflow.vn').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';

    if (email && email.trim().toLowerCase() === adminEmail && password === adminPassword) {
      const token = fastify.jwt.sign({ id: 'u1', email: adminEmail, role: 'ADMIN' });
      return { success: true, token, user: { id: 'u1', name: 'Quản trị viên SellFlow', email: adminEmail, role: 'ADMIN' } };
    }
    return reply.status(401).send({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
  });

  fastify.get('/me', async (request, reply) => {
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@sellflow.vn').trim().toLowerCase();
    return { user: { id: 'u1', name: 'Quản trị viên SellFlow', email: adminEmail, role: 'ADMIN' } };
  });
}
