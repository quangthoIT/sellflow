import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { DEFAULT_TEMPLATES } from '../templates/default-templates.js';
import { getTenantContext, requireTenantContext } from '../../utils/tenant.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Login Handler
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    const inputEmail = (email || '').trim().toLowerCase();

    if (!inputEmail || !password) {
      return reply.status(400).send({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    try {
      const dbUser = await db.user.findUnique({
        where: { email: inputEmail },
        include: { company: true },
      });

      if (dbUser && dbUser.password === password) {
        const token = fastify.jwt.sign({
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          companyId: dbUser.companyId,
        });

        return {
          success: true,
          token,
          user: {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            companyId: dbUser.companyId,
            company: dbUser.company,
          },
        };
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
      // Check if user already exists
      const existingUser = await db.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) {
        return reply.status(400).send({
          success: false,
          message: 'Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.',
        });
      }

      // 1. Create Company entity
      const company = await db.company.create({
        data: {
          name: cleanCompanyName,
          email: cleanEmail,
          phone: (companyPhone || '').trim(),
          address: (companyAddress || '').trim(),
          tax: (companyTax || '').trim(),
          logoUrl: (logoUrl || '').trim(),
        },
      });

      // 2. Create User linked to the Company
      const user = await db.user.create({
        data: {
          email: cleanEmail,
          password: password,
          name: `Quản trị viên - ${cleanCompanyName}`,
          role: 'ADMIN',
          companyId: company.id,
        },
      });

      // 3. Setup Company AppSettings
      const settings = await db.appSetting.create({
        data: {
          companyId: company.id,
          companyName: cleanCompanyName,
          companyAddress: (companyAddress || '').trim(),
          companyPhone: (companyPhone || '').trim(),
          companyEmail: cleanEmail,
          companyTax: (companyTax || '').trim(),
          logoUrl: (logoUrl || '').trim(),
        },
      });

      // 4. Setup Email Settings
      try {
        await db.emailSetting.create({
          data: {
            companyId: company.id,
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

      // 5. Seed Default Templates per Company
      try {
        for (const t of DEFAULT_TEMPLATES) {
          await db.template.create({
            data: {
              id: `${company.id}_${t.id}`,
              companyId: company.id,
              type: t.type,
              name: t.name,
              isDefault: t.isDefault,
              paper: t.paper,
              locked: t.locked,
              content: t.content,
            },
          });
        }
      } catch (tmplErr) {
        console.warn('[Auth] Template seeding warning:', tmplErr);
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: 'ADMIN',
        companyId: company.id,
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'ADMIN',
          companyId: company.id,
          company: {
            id: company.id,
            name: company.name,
          },
        },
        company: settings,
      };
    } catch (err: any) {
      console.error('[Auth] Registration error:', err);
      return reply.status(500).send({
        success: false,
        message: 'Lỗi thiết lập tài khoản: ' + (err.message || 'Lỗi cơ sở dữ liệu'),
      });
    }
  });

  // Get Current Profile
  fastify.get('/me', async (request, reply) => {
    try {
      const tenant = await requireTenantContext(request, reply);
      if (!tenant) return;

      const user = await db.user.findUnique({
        where: { id: tenant.userId },
        include: { company: true },
      });
      return { user };
    } catch {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  // Get/Save Workspace Settings
  fastify.get('/settings', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    try {
      let settings = await db.appSetting.findUnique({
        where: { companyId: tenant.companyId },
      });
      if (!settings) {
        const company = await db.company.findUnique({ where: { id: tenant.companyId } });
        settings = await db.appSetting.create({
          data: {
            companyId: tenant.companyId,
            companyName: company?.name || 'SellFlow Workspace',
            companyEmail: company?.email || '',
            companyPhone: company?.phone || '',
            companyAddress: company?.address || '',
            companyTax: company?.tax || '',
            logoUrl: company?.logoUrl || '',
          },
        });
      }
      return settings;
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  fastify.post('/settings', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const data = request.body as any;
    try {
      const updateData: any = {};
      if (data.company_name !== undefined || data.companyName !== undefined) {
        updateData.companyName = data.company_name ?? data.companyName;
      }
      if (data.company_address !== undefined || data.companyAddress !== undefined) {
        updateData.companyAddress = data.company_address ?? data.companyAddress;
      }
      if (data.company_phone !== undefined || data.companyPhone !== undefined) {
        updateData.companyPhone = data.company_phone ?? data.companyPhone;
      }
      if (data.company_email !== undefined || data.companyEmail !== undefined) {
        updateData.companyEmail = data.company_email ?? data.companyEmail;
      }
      if (data.company_tax !== undefined || data.companyTax !== undefined) {
        updateData.companyTax = data.company_tax ?? data.companyTax;
      }
      if (data.logo_url !== undefined || data.logoUrl !== undefined) {
        updateData.logoUrl = data.logo_url ?? data.logoUrl;
      }
      if (data.quote_prefix !== undefined || data.quotePrefix !== undefined) {
        updateData.quotePrefix = data.quote_prefix ?? data.quotePrefix;
      }
      if (data.contract_prefix !== undefined || data.contractPrefix !== undefined) {
        updateData.contractPrefix = data.contract_prefix ?? data.contractPrefix;
      }
      if (data.payment_prefix !== undefined || data.paymentPrefix !== undefined) {
        updateData.paymentPrefix = data.payment_prefix ?? data.paymentPrefix;
      }
      if (data.customer_prefix !== undefined || data.customerPrefix !== undefined) {
        updateData.customerPrefix = data.customer_prefix ?? data.customerPrefix;
      }
      if (data.product_prefix !== undefined || data.productPrefix !== undefined) {
        updateData.productPrefix = data.product_prefix ?? data.productPrefix;
      }
      if (data.inventory_prefix !== undefined || data.inventoryPrefix !== undefined) {
        updateData.inventoryPrefix = data.inventory_prefix ?? data.inventoryPrefix;
      }
      if (data.email_prefix !== undefined || data.emailPrefix !== undefined) {
        updateData.emailPrefix = data.email_prefix ?? data.emailPrefix;
      }
      if (data.id_format !== undefined || data.idFormat !== undefined) {
        updateData.idFormat = data.id_format ?? data.idFormat;
      }
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.vat_default !== undefined || data.vatDefault !== undefined) {
        updateData.vatDefault = Number(data.vat_default ?? data.vatDefault);
      }
      if (data.quote_valid_days !== undefined || data.quoteValidDays !== undefined) {
        updateData.quoteValidDays = Number(data.quote_valid_days ?? data.quoteValidDays);
      }
      if (data.low_stock_alert !== undefined || data.lowStockAlert !== undefined) {
        updateData.lowStockAlert = Boolean(data.low_stock_alert ?? data.lowStockAlert);
      }

      const settings = await db.appSetting.upsert({
        where: { companyId: tenant.companyId },
        update: updateData,
        create: {
          companyId: tenant.companyId,
          ...updateData,
        },
      });

      // Also update Company record if basic info changed
      if (updateData.companyName || updateData.companyEmail || updateData.companyPhone || updateData.companyAddress || updateData.companyTax || updateData.logoUrl) {
        await db.company.update({
          where: { id: tenant.companyId },
          data: {
            ...(updateData.companyName ? { name: updateData.companyName } : {}),
            ...(updateData.companyEmail ? { email: updateData.companyEmail } : {}),
            ...(updateData.companyPhone ? { phone: updateData.companyPhone } : {}),
            ...(updateData.companyAddress ? { address: updateData.companyAddress } : {}),
            ...(updateData.companyTax ? { tax: updateData.companyTax } : {}),
            ...(updateData.logoUrl ? { logoUrl: updateData.logoUrl } : {}),
          },
        });
      }

      return { success: true, settings };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // Change Password Handler
  fastify.post('/change-password', async (request, reply) => {
    const { email, currentPassword, newPassword, name } = request.body as any;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return reply.status(400).send({ success: false, message: 'Vui lòng cung cấp email' });
    }

    try {
      const user = await db.user.findUnique({ where: { email: cleanEmail } });
      if (!user) {
        return reply.status(404).send({ success: false, message: 'Tài khoản không tồn tại' });
      }

      if (currentPassword && user.password !== currentPassword) {
        return reply.status(400).send({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
      }

      const updated = await db.user.update({
        where: { email: cleanEmail },
        data: {
          ...(newPassword ? { password: newPassword } : {}),
          ...(name ? { name: name.trim() } : {}),
        },
      });

      return { success: true, user: { id: updated.id, name: updated.name, email: updated.email } };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || 'Lỗi cập nhật tài khoản' });
    }
  });
}
