const { pool } = require('../db');

async function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Belum login' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (rows.length === 0) return res.status(401).json({ error: 'Belum login' });
    req.user = rows[0];
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya admin yang boleh mengakses ini' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
