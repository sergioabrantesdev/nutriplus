import { getDB } from '../db.js';

export default async function userRoutes(fastify) {

  fastify.addHook('onRequest', async (req, reply) => {
    try { await req.jwtVerify(); }
    catch { reply.code(401).send({ error: 'Não autorizado.' }); }
  });

  // ── GET /api/user/me ───────────────────────────────────────
  fastify.get('/me', async (req, reply) => {
    const db   = await getDB();
    const user = await db.get(
      'SELECT id, name, email, picture, provider, account_type, created_at FROM users WHERE id = ?',
      req.user.id
    );
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado.' });
    return reply.send(user);
  });

  // ── PATCH /api/user/me ─────────────────────────────────────
  fastify.patch('/me', async (req, reply) => {
    const { name } = req.body;
    if (!name) return reply.code(400).send({ error: 'Nome obrigatório.' });
    const db = await getDB();
    await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    return reply.send({ ok: true, name });
  });
}
