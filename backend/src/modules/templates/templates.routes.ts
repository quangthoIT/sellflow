import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { DEFAULT_TEMPLATES } from './default-templates.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function templatesRoutes(fastify: FastifyInstance) {
  // Ensure default standard templates exist for a given company
  const ensureCompanyTemplates = async (companyId: string) => {
    try {
      const count = await db.template.count({ where: { companyId } });
      if (count === 0) {
        for (const t of DEFAULT_TEMPLATES) {
          await db.template.create({
            data: {
              id: `${companyId}_${t.id}`,
              companyId: companyId,
              type: t.type,
              name: t.name,
              isDefault: t.isDefault,
              paper: t.paper,
              locked: t.locked,
              content: t.content,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Warning: Could not seed templates for company:', err);
    }
  };

  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      await ensureCompanyTemplates(tenant.companyId);
      return await db.template.findMany({
        where: {
          OR: [
            { companyId: tenant.companyId },
            { companyId: null },
          ],
        },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      });
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const data = request.body as any;
    try {
      const id = data.id || `TMP_${Date.now()}`;
      const templateData = {
        companyId: tenant.companyId,
        type: data.type || 'quote',
        name: data.name,
        isDefault: Boolean(data.isDefault ?? data.is_default),
        paper: data.paper || 'A4',
        locked: Boolean(data.locked),
        content: data.content || '',
      };

      if (templateData.isDefault) {
        await db.template.updateMany({
          where: { type: templateData.type, companyId: tenant.companyId },
          data: { isDefault: false },
        });
      }

      const existing = await db.template.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      let template;
      if (existing) {
        template = await db.template.update({
          where: { id },
          data: templateData,
        });
      } else {
        template = await db.template.create({
          data: { id, ...templateData },
        });
      }

      return { success: true, template };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.post('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    const data = request.body as any;
    try {
      const templateData: any = {};
      if (data.name !== undefined) templateData.name = data.name;
      if (data.type !== undefined) templateData.type = data.type;
      if (data.isDefault !== undefined || data.is_default !== undefined) {
        templateData.isDefault = Boolean(data.isDefault ?? data.is_default);
      }
      if (data.paper !== undefined) templateData.paper = data.paper;
      if (data.locked !== undefined) templateData.locked = Boolean(data.locked);
      if (data.content !== undefined) templateData.content = data.content;

      if (templateData.isDefault && templateData.type) {
        await db.template.updateMany({
          where: { type: templateData.type, companyId: tenant.companyId },
          data: { isDefault: false },
        });
      }

      const existing = await db.template.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      let template;
      if (existing) {
        template = await db.template.update({
          where: { id },
          data: templateData,
        });
      } else {
        template = await db.template.create({
          data: { id, companyId: tenant.companyId, ...templateData },
        });
      }

      return { success: true, template };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const res = await db.template.deleteMany({
        where: { id, companyId: tenant.companyId },
      });
      if (res.count === 0) {
        return reply.status(404).send({ success: false, message: 'Mẫu tài liệu không tồn tại' });
      }
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
