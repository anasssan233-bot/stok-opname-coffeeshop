const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, nextId } = require('../db');
const { requireAuth, requireAdmin } = require('./authGuard');
const asyncHandler = require('./asyncHandler');

const router = express.Router();
router.use(requireAuth);

// ---------- CABANG ----------
router.get('/cabang', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cabang ORDER BY nama');
  res.json(rows);
}));

router.post('/cabang', requireAdmin, asyncHandler(async (req, res) => {
  const { nama, alamat } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'Nama cabang wajib diisi' });
  const id = await nextId('cb');
  await pool.query('INSERT INTO cabang (id, nama, alamat) VALUES ($1,$2,$3)', [id, nama, alamat || '']);
  res.json({ id, nama, alamat: alamat || '' });
}));

router.put('/cabang/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { nama, alamat } = req.body || {};
  const { rows } = await pool.query(
    'UPDATE cabang SET nama = COALESCE($1, nama), alamat = COALESCE($2, alamat) WHERE id = $3 RETURNING *',
    [nama, alamat, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Cabang tidak ditemukan' });
  res.json(rows[0]);
}));

router.delete('/cabang/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cabang WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- ITEMS ----------
// GET /api/items?cabangId=xxx -> daftar item milik satu cabang
router.get('/items', asyncHandler(async (req, res) => {
  let cabangId = req.query.cabangId;
  if (req.user.role !== 'admin') cabangId = req.user.cabangId;
  if (cabangId) {
    const { rows } = await pool.query('SELECT * FROM items WHERE "cabangId" = $1 ORDER BY nama', [cabangId]);
    return res.json(rows);
  }
  const { rows } = await pool.query('SELECT * FROM items ORDER BY nama');
  res.json(rows);
}));

router.post('/items', requireAdmin, asyncHandler(async (req, res) => {
  const { nama, satuan, kategori, cabangId } = req.body || {};
  if (!nama || !satuan) return res.status(400).json({ error: 'Nama dan satuan wajib diisi' });
  if (!cabangId) return res.status(400).json({ error: 'Cabang wajib dipilih untuk item ini' });
  const cabangCheck = await pool.query('SELECT id FROM cabang WHERE id = $1', [cabangId]);
  if (cabangCheck.rows.length === 0) return res.status(400).json({ error: 'Cabang tidak valid' });
  const id = await nextId('it');
  await pool.query(
    'INSERT INTO items (id, "cabangId", nama, satuan, kategori) VALUES ($1,$2,$3,$4,$5)',
    [id, cabangId, nama, satuan, kategori || 'Lainnya']
  );
  res.json({ id, cabangId, nama, satuan, kategori: kategori || 'Lainnya' });
}));

router.put('/items/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { nama, satuan, kategori } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE items SET nama = COALESCE($1, nama), satuan = COALESCE($2, satuan), kategori = COALESCE($3, kategori)
     WHERE id = $4 RETURNING *`,
    [nama, satuan, kategori, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Item tidak ditemukan' });
  res.json(rows[0]);
}));

router.delete('/items/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- USERS (staf) ----------
router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, nama, role, "cabangId" FROM users ORDER BY nama');
  res.json(rows);
}));

router.post('/users', requireAdmin, asyncHandler(async (req, res) => {
  const { username, password, nama, role, cabangId } = req.body || {};
  if (!username || !password || !nama || !role) {
    return res.status(400).json({ error: 'Data user belum lengkap' });
  }
  const exists = await pool.query('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
  if (exists.rows.length > 0) return res.status(400).json({ error: 'Username sudah dipakai' });

  const id = await nextId('u');
  const finalCabangId = role === 'admin' ? null : (cabangId || null);
  const passwordHash = bcrypt.hashSync(password, 8);
  await pool.query(
    'INSERT INTO users (id, username, nama, role, "cabangId", "passwordHash") VALUES ($1,$2,$3,$4,$5,$6)',
    [id, username, nama, role, finalCabangId, passwordHash]
  );
  res.json({ id, username, nama, role, cabangId: finalCabangId });
}));

router.delete('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
  }
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
