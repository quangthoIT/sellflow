import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { DEFAULT_TEMPLATES } from '../templates/default-templates.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    const inputEmail = (email || '').trim().toLowerCase();

    if (!inputEmail || !password) {
      return reply.status(400).send({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // Authenticate registered user in PostgreSQL database
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

      // 3. Setup Email Settings
      try {
        await db.emailSetting.upsert({
          where: { id: 'default' },
          update: {
            senderName: cleanCompanyName,
            senderEmail: cleanEmail,
          },
          create: {
            id: 'default',
            senderName: cleanCompanyName,
            senderEmail: cleanEmail,
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            autoSend: false,
          },
        });
      } catch (emailSetErr) {
        console.warn('[Auth] Email setting sync warning:', emailSetErr);
      }

      // 4. Ensure Default Templates Exist
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
    try {
      await request.jwtVerify();
      const user = (request as any).user;
      return { user };
    } catch {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });
}
