import bcrypt from 'bcryptjs';
import { getDB } from '../db.js';

const ADMIN_PASSWORD = 'nutriplus-admin-2026';

export default async function adminRoutes(fastify) {

  // ── POST /api/admin/login ──────────────────────────────────
  fastify.post('/login', async (req, reply) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD)
      return reply.code(401).send({ error: 'Senha incorreta.' });
    const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: '8h' });
    return reply.send({ token });
  });

  // ── Hook de autenticação (todas as rotas exceto /login) ────
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.routeOptions.url === '/api/admin/login') return;
    try {
      await req.jwtVerify();
      if (req.user.role !== 'admin')
        return reply.code(403).send({ error: 'Acesso negado.' });
    } catch {
      reply.code(401).send({ error: 'Não autorizado.' });
    }
  });

  // ── GET /api/admin/users/:id ──────────────────────────────
  fastify.get('/users/:id', async (req, reply) => {
    const db   = await getDB();
    const user = await db.get(`
      SELECT id, name, email,
             CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END AS has_password,
             provider, google_id, picture, account_type, active,
             crn, specialty, institution, grade, edu_level,
             created_at
      FROM users WHERE id = ?
    `, req.params.id);
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado.' });
    return reply.send(user);
  });

  // ── GET /api/admin/users ───────────────────────────────────
  fastify.get('/users', async (req, reply) => {
    const db    = await getDB();
    const users = await db.all(`
      SELECT id, name, email,
             CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END AS has_password,
             provider, google_id, picture, account_type,
             active, created_at
      FROM users ORDER BY created_at DESC
    `);
    return reply.send({ total: users.length, users });
  });

  // ── PATCH /api/admin/users/:id ─────────────────────────────
  // Edita nome, email, account_type
  fastify.patch('/users/:id', async (req, reply) => {
    const { name, email, account_type } = req.body;
    const db = await getDB();

    if (email) {
      const conflict = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.toLowerCase(), req.params.id]
      );
      if (conflict) return reply.code(409).send({ error: 'E-mail já em uso.' });
    }

    const fields = [];
    const values = [];
    if (name)         { fields.push('name = ?');         values.push(name); }
    if (email)        { fields.push('email = ?');        values.push(email.toLowerCase()); }
    if (account_type) { fields.push('account_type = ?'); values.push(account_type); }

    if (!fields.length) return reply.code(400).send({ error: 'Nenhum campo para atualizar.' });

    values.push(req.params.id);
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await db.get('SELECT id, name, email, account_type, active FROM users WHERE id = ?', req.params.id);
    return reply.send({ ok: true, user: updated });
  });

  // ── POST /api/admin/users/:id/reset-password ───────────────
  fastify.post('/users/:id/reset-password', async (req, reply) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 5)
      return reply.code(400).send({ error: 'Senha deve ter pelo menos 5 caracteres.' });

    const hash = await bcrypt.hash(new_password, 10);
    const db   = await getDB();
    const res  = await db.run(
      'UPDATE users SET password = ?, provider = ? WHERE id = ?',
      [hash, 'email', req.params.id]
    );
    if (!res.changes) return reply.code(404).send({ error: 'Usuário não encontrado.' });
    return reply.send({ ok: true });
  });

  // ── POST /api/admin/users/:id/toggle-active ────────────────
  // Ativa ou suspende o usuário
  fastify.post('/users/:id/toggle-active', async (req, reply) => {
    const db   = await getDB();
    const user = await db.get('SELECT active FROM users WHERE id = ?', req.params.id);
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado.' });

    const newState = user.active ? 0 : 1;
    await db.run('UPDATE users SET active = ? WHERE id = ?', [newState, req.params.id]);
    return reply.send({ ok: true, active: newState });
  });

  // ── DELETE /api/admin/users/:id ────────────────────────────
  fastify.delete('/users/:id', async (req, reply) => {
    const db = await getDB();
    const res = await db.run('DELETE FROM users WHERE id = ?', req.params.id);
    if (!res.changes) return reply.code(404).send({ error: 'Usuário não encontrado.' });
    return reply.send({ ok: true });
  });

  // ── GET /api/admin/stats ───────────────────────────────────
  fastify.get('/stats', async (req, reply) => {
    const db = await getDB();
    const [total, byProvider, byType, recent] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM users'),
      db.all('SELECT provider, COUNT(*) as count FROM users GROUP BY provider'),
      db.all('SELECT account_type, COUNT(*) as count FROM users GROUP BY account_type'),
      db.all('SELECT id, name, email, provider, created_at FROM users ORDER BY created_at DESC LIMIT 5'),
    ]);
    return reply.send({ total: total.count, byProvider, byType, recent });
  });
}
