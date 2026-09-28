import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function templatesRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    try {
      return await db.template.findMany({ orderBy: { createdAt: 'desc' } });
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
        isDefault: data.isDefault || false,
        paper: data.paper || 'A4',
        content: data.content || '',
      };

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
