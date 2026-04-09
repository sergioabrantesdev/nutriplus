import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Garante que a pasta data/ existe
mkdirSync(join(__dirname, '../data'), { recursive: true });

const fastify = Fastify({ logger: true });

// CORS — permite o Vite dev server chamar a API
await fastify.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
});

// JWT — troque o secret por uma variável de ambiente em produção
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET,
});

// Rotas
await fastify.register(authRoutes,  { prefix: '/api/auth' });
await fastify.register(userRoutes,  { prefix: '/api/user' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }));

// Inicia DB e servidor
await initDB();
await fastify.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' });
console.log('🥦 NutriPlus API rodando em http://localhost:3333');
