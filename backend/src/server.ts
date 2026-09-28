import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config/index.js';
import { appRoutes } from './routes/index.js';

const fastify = Fastify({ logger: true });

async function start() {
  try {
    await fastify.register(cors, { origin: '*' });
    await fastify.register(jwt, { secret: config.jwtSecret });

    // API routes prefix
    await fastify.register(appRoutes, { prefix: '/api' });

    // Health check endpoint
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Fastify Backend Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
