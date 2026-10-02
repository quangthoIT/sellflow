import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { DEFAULT_TEMPLATES } from '../templates/default-templates.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    const inputEmail = (email || '').trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@sellflow.vn').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';

    // 1. Check configured environment admin credentials
    if (inputEmail === adminEmail && password === adminPassword) {
      const token = fastify.jwt.sign({ id: 'admin-1', email: adminEmail, role: 'ADMIN' });
      return { success: true, token, user: { id: 'admin-1', name: 'Quản trị viên SellFlow', email: adminEmail, role: 'ADMIN' } };
    }

    // 2. Check registered user in PostgreSQL database
    try {
      const dbUser = await db.user.findUnique({
        where: { email: inputEmail },
      });
      if (dbUser && dbUser.password === password) {
        const token = fastify.jwt.sign({ id: dbUser.id, email: dbUser.email, role: dbUser.role });
        return { success: true, token, user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role } };
      }
    } catch (err) {
      console.warn('[Auth] Database lookup warning:', err);
    }

    return reply.status(401).send({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
  });

  // Register & Onboarding Workspace Handler
  fastify.post('/register', async (request, reply) => {
    const {
      email,
      password,
      companyName,
      logoUrl,
      companyTax,
      companyPhone,
      companyAddress,
    } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCompanyName = (companyName || '').trim() || 'SellFlow Workspace';

    try {
      // 1. Create or update user in PostgreSQL database
      const user = await db.user.upsert({
        where: { email: cleanEmail },
        update: {
          password: password,
          name: `Quản trị viên - ${cleanCompanyName}`,
          role: 'ADMIN',
        },
        create: {
          email: cleanEmail,
          password: password,
          name: `Quản trị viên - ${cleanCompanyName}`,
          role: 'ADMIN',
        },
      });

      // 2. Setup Company AppSettings
      const settings = await db.appSetting.upsert({
        where: { id: 1 },
        update: {
          companyName: cleanCompanyName,
          companyAddress: (companyAddress || '').trim(),
          companyPhone: (companyPhone || '').trim(),
          companyEmail: cleanEmail,
          companyTax: (companyTax || '').trim(),
          logoUrl: (logoUrl || '').trim(),
        },
        create: {
          id: 1,
          companyName: cleanCompanyName,
          companyAddress: (companyAddress || '').trim(),
          companyPhone: (companyPhone || '').trim(),
          companyEmail: cleanEmail,
          companyTax: (companyTax || '').trim(),
          logoUrl: (logoUrl || '').trim(),
        },
      });

      // 3. Ensure Default Templates Exist
      try {
        for (const t of DEFAULT_TEMPLATES) {
          await db.template.upsert({
            where: { id: t.id },
            update: {},
            create: t,
          });
        }
      } catch (tmplErr) {
        console.warn('[Auth] Template seeding warning:', tmplErr);
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: 'ADMIN' });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'ADMIN',
        },
        company: settings,
      };
    } catch (err: any) {
      console.error('[Auth] Registration error:', err);
      return reply.status(500).send({ success: false, message: 'Lỗi thiết lập tài khoản: ' + (err.message || 'Lỗi cơ sở dữ liệu') });
    }
  });

  fastify.get('/me', async (request, reply) => {
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@sellflow.vn').trim().toLowerCase();
    return { user: { id: 'u1', name: 'Quản trị viên SellFlow', email: adminEmail, role: 'ADMIN' } };
  });
}
