import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { DEFAULT_TEMPLATES } from './default-templates.js';

export async function templatesRoutes(fastify: FastifyInstance) {
  // Ensure default standard templates exist on startup / first query
  const ensureDefaultTemplates = async () => {
    try {
      for (const t of DEFAULT_TEMPLATES) {
        await db.template.upsert({
          where: { id: t.id },
          update: {
            name: t.name,
            type: t.type,
            paper: t.paper,
            content: t.content,
          },
          create: t,
        });
      }
    } catch (err) {
      console.warn('Warning: Could not auto-seed default templates:', err);
    }
  };

  fastify.get('/', async () => {
    try {
      const count = await db.template.count();
      if (count === 0) {
        await ensureDefaultTemplates();
      }
      return await db.template.findMany({ orderBy: [{ type: 'asc' }, { createdAt: 'desc' }] });
    } catch (err) {
      return [];
    }
  });

  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `TMP_${Date.now()}`;
      const templateData = {
        type: data.type || 'quote',
        name: data.name,
        isDefault: Boolean(data.isDefault ?? data.is_default),
        paper: data.paper || 'A4',
        locked: Boolean(data.locked),
        content: data.content || '',
      };

      if (templateData.isDefault) {
        await db.template.updateMany({
          where: { type: templateData.type },
          data: { isDefault: false },
        });
      }

      const template = await db.template.upsert({
        where: { id },
        update: templateData,
        create: { id, ...templateData },
      });

      return { success: true, template };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.post('/:id', async (request, reply) => {
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
          where: { type: templateData.type },
          data: { isDefault: false },
        });
      }

      const template = await db.template.upsert({
        where: { id },
        update: templateData,
        create: { id, ...templateData },
      });

      return { success: true, template };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.template.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}

