import bcrypt from 'bcryptjs';
import { getDB } from '../db.js';

export default async function authRoutes(fastify) {

  // ── POST /api/auth/register ────────────────────────────────
  fastify.post('/register', async (req, reply) => {
    const { name, email, password, account_type = 'pro', crn, specialty, institution, grade, edu_level } = req.body;
    if (!name || !email || !password)
      return reply.code(400).send({ error: 'Campos obrigatórios faltando.' });

    const db = await getDB();
    const exists = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase());
    if (exists) return reply.code(409).send({ error: 'E-mail já cadastrado.' });

    const hash   = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (name, email, password, provider, account_type, crn, specialty, institution, grade, edu_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email.toLowerCase(), hash, 'email', account_type, crn||null, specialty||null, institution||null, grade||null, edu_level||null]
    );

    const token = fastify.jwt.sign({ id: result.lastID, email, name });
    return reply.code(201).send({ token, user: { id: result.lastID, name, email, account_type } });
  });

  // ── POST /api/auth/login ───────────────────────────────────
  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body;
    if (!email || !password)
      return reply.code(400).send({ error: 'E-mail e senha são obrigatórios.' });

    const db   = await getDB();
    const user = await db.get('SELECT * FROM users WHERE email = ?', email.toLowerCase());

    if (!user || !user.password)
      return reply.code(401).send({ error: 'E-mail ou senha incorretos.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return reply.code(401).send({ error: 'E-mail ou senha incorretos.' });

    const token = fastify.jwt.sign({ id: user.id, email: user.email, name: user.name });
    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, picture: user.picture, account_type: user.account_type },
    });
  });

  // ── POST /api/auth/google ──────────────────────────────────
  fastify.post('/google', async (req, reply) => {
    const { access_token, display_name } = req.body;
    if (!access_token) return reply.code(400).send({ error: 'access_token obrigatório.' });

    let googleUser;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + access_token },
      });
      if (!res.ok) throw new Error();
      googleUser = await res.json();
    } catch {
      return reply.code(401).send({ error: 'Token do Google inválido.' });
    }

    const { sub: google_id, email, name: googleName, picture } = googleUser;
    const finalName = display_name || googleName;
    const db = await getDB();

    let user = await db.get(
      'SELECT * FROM users WHERE google_id = ? OR email = ?',
      [google_id, email.toLowerCase()]
    );

    if (user) {
      const updatedName = display_name || user.name;
      await db.run(
        'UPDATE users SET google_id = ?, picture = ?, name = ? WHERE id = ?',
        [google_id, picture, updatedName, user.id]
      );
      user = { ...user, name: updatedName, picture };
    } else {
      const result = await db.run(
        'INSERT INTO users (name, email, provider, google_id, picture) VALUES (?, ?, ?, ?, ?)',
        [finalName, email.toLowerCase(), 'google', google_id, picture]
      );
      user = { id: result.lastID, name: finalName, email, picture, account_type: 'pro' };
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email || email, name: user.name });
    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email || email, picture: user.picture },
    });
  });
}
