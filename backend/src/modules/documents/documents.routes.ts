import { FastifyInstance } from 'fastify';

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post('/generate-pdf', async (request, reply) => {
    const { documentId, documentType } = request.body as any;
    return {
      success: true,
      message: `Job PDF generated for ${documentType} #${documentId}`,
      downloadUrl: `/storage/${documentType}s/${documentId}.pdf`,
    };
  });
}
