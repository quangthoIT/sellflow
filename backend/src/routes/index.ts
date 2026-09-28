import { FastifyInstance } from 'fastify';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { productsRoutes } from '../modules/products/products.routes.js';
import { inventoryRoutes } from '../modules/inventory/inventory.routes.js';
import { customersRoutes } from '../modules/customers/customers.routes.js';
import { quotationsRoutes } from '../modules/quotations/quotations.routes.js';
import { contractsRoutes } from '../modules/contracts/contracts.routes.js';
import { paymentsRoutes } from '../modules/payments/payments.routes.js';
import { templatesRoutes } from '../modules/templates/templates.routes.js';
import { documentsRoutes } from '../modules/documents/documents.routes.js';
import { emailsRoutes } from '../modules/emails/emails.routes.js';
import { reportsRoutes } from '../modules/reports/reports.routes.js';

export async function appRoutes(fastify: FastifyInstance) {
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(usersRoutes, { prefix: '/users' });
  fastify.register(productsRoutes, { prefix: '/products' });
  fastify.register(inventoryRoutes, { prefix: '/inventory' });
  fastify.register(customersRoutes, { prefix: '/customers' });
  fastify.register(quotationsRoutes, { prefix: '/quotations' });
  fastify.register(contractsRoutes, { prefix: '/contracts' });
  fastify.register(paymentsRoutes, { prefix: '/payments' });
  fastify.register(templatesRoutes, { prefix: '/templates' });
  fastify.register(documentsRoutes, { prefix: '/documents' });
  fastify.register(emailsRoutes, { prefix: '/emails' });
  fastify.register(reportsRoutes, { prefix: '/reports' });
}
