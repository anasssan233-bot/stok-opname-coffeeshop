const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

function shapeUser(u, cabangNama) {
  return {
    id: u.id, username: u.username, nama: u.nama, role: u.role,
    cabangId: u.cabangId, cabangNama: cabangNama || null
  };
}

async function getCabangNama(cabangId) {
  if (!cabangId) return null;
  const { rows } = await pool.query('SELECT nama FROM cabang WHERE id = $1', [cabangId]);
  return rows[0] ? rows[0].nama : null;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(username) = lower($1)', [username]
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    req.session.userId = user.id;
    const cabangNama = await getCabangNama(user.cabangId);
    res.json(shapeUser(user, cabangNama));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Belum login' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Belum login' });
    const cabangNama = await getCabangNama(user.cabangId);
    res.json(shapeUser(user, cabangNama));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

module.exports = router;
