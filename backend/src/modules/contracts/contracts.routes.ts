import { FastifyInstance } from 'fastify';
import { db } from '../../config/db.js';

export async function contractsRoutes(fastify: FastifyInstance) {
  // Get all contracts
  fastify.get('/', async () => {
    try {
      const contracts = await db.contract.findMany({
        include: { customer: true, items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });
      return contracts.map(c => ({
        ...c,
        quoteId: c.quoteId,
        quote_id: c.quoteId,
        customerId: c.customerId,
        customer_id: c.customerId,
        stockApplied: c.stockApplied,
        stock_applied: c.stockApplied,
        template_id: c.templateId,
        payment_terms: c.paymentTerms,
        items: c.items.map(i => ({
          ...i,
          contractId: i.contractId,
          contract_id: i.contractId,
          productId: i.productId,
          product_id: i.productId,
          productName: i.productName,
          product_name: i.productName,
          price: Number(i.price),
        })),
        payments: c.payments.map(p => ({
          ...p,
          contractId: p.contractId,
          contract_id: p.contractId,
          amount: Number(p.amount),
        })),
      }));
    } catch (err) {
      return [];
    }
  });

  // Get all contract items
  fastify.get('/items', async () => {
    try {
      const items = await db.contractItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return items.map(i => ({
        ...i,
        contractId: i.contractId,
        contract_id: i.contractId,
        productId: i.productId,
        product_id: i.productId,
        productName: i.productName,
        product_name: i.productName,
        price: Number(i.price),
      }));
    } catch (err) {
      return [];
    }
  });

  // Get single contract
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const c = await db.contract.findUnique({
        where: { id },
        include: { customer: true, items: true, payments: true },
      });
      if (!c) return reply.status(404).send({ success: false, message: 'Not found' });
      return {
        ...c,
        quoteId: c.quoteId,
        quote_id: c.quoteId,
        customerId: c.customerId,
        customer_id: c.customerId,
        stockApplied: c.stockApplied,
        stock_applied: c.stockApplied,
        template_id: c.templateId,
        payment_terms: c.paymentTerms,
        items: c.items.map(i => ({
          ...i,
          contractId: i.contractId,
          contract_id: i.contractId,
          productId: i.productId,
          product_id: i.productId,
          productName: i.productName,
          product_name: i.productName,
          price: Number(i.price),
        })),
        payments: c.payments.map(p => ({
          ...p,
          contractId: p.contractId,
          contract_id: p.contractId,
          amount: Number(p.amount),
        })),
      };
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // Upsert contract
  fastify.post('/', async (request, reply) => {
    const data = request.body as any;
    try {
      const id = data.id || `HD${Date.now()}`;
      const contractData: any = {
        quoteId: data.quoteId || data.quote_id || null,
        customerId: data.customerId || data.customer_id || null,
        date: new Date(data.date || Date.now()),
        status: data.status || 'Nháp',
        stockApplied: Boolean(data.stockApplied ?? data.stock_applied ?? false),
        templateId: data.templateId || data.template_id || null,
        paymentTerms: data.paymentTerms || data.payment_terms || null,
        notes: data.notes || '',
      };

      await db.contract.upsert({
        where: { id },
        update: contractData,
        create: { id, ...contractData },
      });

      if (data.items && Array.isArray(data.items)) {
        await db.contractItem.deleteMany({ where: { contractId: id } });
        if (data.items.length > 0) {
          await db.contractItem.createMany({
            data: data.items.map((item: any) => ({
              id: item.id || undefined,
              contractId: id,
              productId: item.productId || item.product_id || null,
              productName: item.productName || item.product_name || '',
              qty: Number(item.qty || 1),
              price: BigInt(Math.round(Number(item.price || 0))),
            })),
          });
        }
      }

      const updated = await db.contract.findUnique({ where: { id }, include: { items: true, payments: true } });
      return { success: true, contract: updated };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Add / Upsert contract items directly
  fastify.post('/items', async (request, reply) => {
    const data = request.body as any;
    try {
      const items = Array.isArray(data) ? data : [data];
      const created = [];
      for (const item of items) {
        const row = await db.contractItem.create({
          data: {
            id: item.id || undefined,
            contractId: item.contractId || item.contract_id,
            productId: item.productId || item.product_id || null,
            productName: item.productName || item.product_name || '',
            qty: Number(item.qty || 1),
            price: BigInt(Math.round(Number(item.price || 0))),
          },
        });
        created.push(row);
      }
      return Array.isArray(data) ? created : created[0];
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete contract items by contractId
  fastify.delete('/items/by-contract/:contractId', async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    try {
      await db.contractItem.deleteMany({ where: { contractId } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete contract item by id
  fastify.delete('/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.contractItem.deleteMany({ where: { OR: [{ id }, { contractId: id }] } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });

  // Delete contract
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await db.contract.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  });
}
