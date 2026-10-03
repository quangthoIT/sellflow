import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';
import { requireTenantContext } from '../../utils/tenant.js';

export async function quotationsRoutes(fastify: FastifyInstance) {
  // Get all quotations for company
  fastify.get('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      const quotes = await db.quote.findMany({
        where: { companyId: tenant.companyId },
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
      return quotes.map(q => ({
        ...q,
        customerId: q.customerId,
        customer_id: q.customerId,
        discount: Number(q.discount),
        shipping: Number(q.shipping),
        vat_pct: q.vatPct,
        template_id: q.templateId,
        valid_until: q.validUntil ? q.validUntil.toISOString().split('T')[0] : null,
        payment_terms: q.paymentTerms,
        items: q.items.map(i => ({
          ...i,
          quoteId: i.quoteId,
          quote_id: i.quoteId,
          productId: i.productId,
          product_id: i.productId,
          productName: i.productName,
          product_name: i.productName,
          price: Number(i.price),
          discount: Number(i.discount),
        })),
      }));
    } catch (err) {
      return [];
    }
  });

  // Get all quote items for company
  fastify.get('/items', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return [];

    try {
      const items = await db.quoteItem.findMany({
        where: { quote: { companyId: tenant.companyId } },
        orderBy: { createdAt: 'asc' },
      });
      return items.map(i => ({
        ...i,
        quoteId: i.quoteId,
        quote_id: i.quoteId,
        productId: i.productId,
        product_id: i.productId,
        productName: i.productName,
        product_name: i.productName,
        price: Number(i.price),
        discount: Number(i.discount),
      }));
    } catch (err) {
      return [];
    }
  });

  // Get single quotation
  fastify.get('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const q = await db.quote.findFirst({
        where: { id, companyId: tenant.companyId },
        include: { customer: true, items: true },
      });
      if (!q) return reply.status(404).send({ success: false, message: 'Không tìm thấy báo giá' });
      return {
        ...q,
        customerId: q.customerId,
        customer_id: q.customerId,
        discount: Number(q.discount),
        shipping: Number(q.shipping),
        vat_pct: q.vatPct,
        template_id: q.templateId,
        valid_until: q.validUntil ? q.validUntil.toISOString().split('T')[0] : null,
        payment_terms: q.paymentTerms,
        items: q.items.map(i => ({
          ...i,
          quoteId: i.quoteId,
          quote_id: i.quoteId,
          productId: i.productId,
          product_id: i.productId,
          productName: i.productName,
          product_name: i.productName,
          price: Number(i.price),
          discount: Number(i.discount),
        })),
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // Upsert quotation
  fastify.post('/', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const data = request.body as any;
    try {
      const id = data.id || `BG${Date.now()}`;
      const quoteData: any = {
        customerId: data.customerId || data.customer_id || null,
        date: new Date(data.date || Date.now()),
        status: data.status || 'Nháp',
        discount: BigInt(Math.round(Number(data.discount || 0))),
        vatPct: Number(data.vatPct ?? data.vat_pct ?? 0),
        shipping: BigInt(Math.round(Number(data.shipping || 0))),
        templateId: data.templateId || data.template_id || null,
        notes: data.notes || '',
        validUntil: data.validUntil || data.valid_until ? new Date(data.validUntil || data.valid_until) : null,
        paymentTerms: data.paymentTerms || data.payment_terms || null,
      };

      const existing = await db.quote.findFirst({
        where: { id, companyId: tenant.companyId },
      });

      if (existing) {
        await db.quote.update({
          where: { id },
          data: quoteData,
        });
      } else {
        await db.quote.create({
          data: {
            id,
            companyId: tenant.companyId,
            ...quoteData,
          },
        });
      }

      if (data.items && Array.isArray(data.items)) {
        await db.quoteItem.deleteMany({ where: { quoteId: id } });
        if (data.items.length > 0) {
          await db.quoteItem.createMany({
            data: data.items.map((item: any) => ({
              id: item.id || undefined,
              quoteId: id,
              productId: item.productId || item.product_id || null,
              productName: item.productName || item.product_name || '',
              qty: Number(item.qty || 1),
              price: BigInt(Math.round(Number(item.price || 0))),
              discount: BigInt(Math.round(Number(item.discount || 0))),
            })),
          });
        }
      }

      const updated = await db.quote.findUnique({ where: { id }, include: { items: true } });
      return { success: true, quote: updated };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Add / Upsert quote items directly
  fastify.post('/items', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const data = request.body as any;
    try {
      const items = Array.isArray(data) ? data : [data];
      const created = [];
      for (const item of items) {
        const quoteId = item.quoteId || item.quote_id;
        // Verify quote ownership
        const quote = await db.quote.findFirst({ where: { id: quoteId, companyId: tenant.companyId } });
        if (!quote) continue;

        const row = await db.quoteItem.create({
          data: {
            id: item.id || undefined,
            quoteId: quoteId,
            productId: item.productId || item.product_id || null,
            productName: item.productName || item.product_name || '',
            qty: Number(item.qty || 1),
            price: BigInt(Math.round(Number(item.price || 0))),
            discount: BigInt(Math.round(Number(item.discount || 0))),
          },
        });
        created.push(row);
      }
      return Array.isArray(data) ? created : created[0];
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete quote items by quoteId
  fastify.delete('/items/by-quote/:quoteId', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { quoteId } = request.params as { quoteId: string };
    try {
      const quote = await db.quote.findFirst({ where: { id: quoteId, companyId: tenant.companyId } });
      if (!quote) {
        return reply.status(404).send({ success: false, message: 'Báo giá không tồn tại' });
      }
      await db.quoteItem.deleteMany({ where: { quoteId } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete quote item by id
  fastify.delete('/items/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      await db.quoteItem.deleteMany({
        where: {
          OR: [{ id }, { quoteId: id }],
          quote: { companyId: tenant.companyId },
        },
      });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete quotation
  fastify.delete('/:id', async (request, reply) => {
    const tenant = await requireTenantContext(request, reply);
    if (!tenant) return;

    const { id } = request.params as { id: string };
    try {
      const res = await db.quote.deleteMany({
        where: { id, companyId: tenant.companyId },
      });
      if (res.count === 0) {
        return reply.status(404).send({ success: false, message: 'Báo giá không tồn tại hoặc không thuộc doanh nghiệp' });
      }
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
