import { FastifyRequest } from 'fastify';
import { db } from '../config/db.js';

export interface TenantContext {
  userId?: string;
  email?: string;
  role?: string;
  companyId: string;
}

export async function getTenantContext(request: FastifyRequest): Promise<TenantContext | null> {
  // 1. Try JWT verification from Authorization: Bearer <token>
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const decoded: any = (request.server as any).jwt.verify(token);
        if (decoded && decoded.companyId) {
          return {
            userId: decoded.id,
            email: decoded.email,
            role: decoded.role,
            companyId: decoded.companyId,
          };
        }
        if (decoded && decoded.id) {
          const user = await db.user.findUnique({ where: { id: decoded.id } });
          if (user && user.companyId) {
            return {
              userId: user.id,
              email: user.email,
              role: user.role,
              companyId: user.companyId,
            };
          }
        }
      }
    }
  } catch (err) {
    // JWT verification failed or expired, continue to fallback headers
  }

  // 2. Check X-Company-Id header
  const headerCompanyId = request.headers['x-company-id'] as string;
  if (headerCompanyId && typeof headerCompanyId === 'string' && headerCompanyId.trim()) {
    return { companyId: headerCompanyId.trim() };
  }

  // 3. Check query param or body
  const queryCompanyId = (request.query as any)?.companyId;
  if (queryCompanyId && typeof queryCompanyId === 'string' && queryCompanyId.trim()) {
    return { companyId: queryCompanyId.trim() };
  }

  const bodyCompanyId = (request.body as any)?.companyId || (request.body as any)?.company_id;
  if (bodyCompanyId && typeof bodyCompanyId === 'string' && bodyCompanyId.trim()) {
    return { companyId: bodyCompanyId.trim() };
  }

  return null;
}

export async function requireTenantContext(request: FastifyRequest, reply: any): Promise<TenantContext | null> {
  const tenant = await getTenantContext(request);
  if (!tenant || !tenant.companyId) {
    reply.status(401).send({
      success: false,
      message: 'Yêu cầu định danh doanh nghiệp (Company Context / Authorization Header missing)',
    });
    return null;
  }
  return tenant;
}
