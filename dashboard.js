const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  const cabangRes = isAdmin
    ? await pool.query('SELECT * FROM cabang ORDER BY nama')
    : await pool.query('SELECT * FROM cabang WHERE id = $1', [req.user.cabangId]);
  const cabangList = cabangRes.rows;

  const opnameRes = isAdmin
    ? await pool.query('SELECT * FROM opname')
    : await pool.query('SELECT * FROM opname WHERE "cabangId" = $1', [req.user.cabangId]);
  const scoped = opnameRes.rows;

  const perCabang = cabangList.map(c => {
    const entries = scoped.filter(o => o.cabangId === c.id);
    const last = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    let totalSelisihTerakhir = 0;
    let itemBedaTerakhir = 0;
    if (last) {
      totalSelisihTerakhir = last.details.reduce((s, d) => s + Math.abs(d.selisih), 0);
      itemBedaTerakhir = last.details.filter(d => d.selisih !== 0).length;
    }
    return {
      cabangId: c.id,
      cabangNama: c.nama,
      jumlahOpname: entries.length,
      tanggalTerakhir: last ? last.tanggal : null,
      itemBedaTerakhir,
      totalSelisihTerakhir
    };
  });

  const itemSelisihMap = new Map();
  scoped.forEach(o => {
    o.details.forEach(d => {
      if (d.selisih === 0) return;
      const key = d.itemNama;
      const cur = itemSelisihMap.get(key) || { itemNama: key, satuan: d.satuan, totalSelisihAbs: 0, kejadian: 0 };
      cur.totalSelisihAbs += Math.abs(d.selisih);
      cur.kejadian += 1;
      itemSelisihMap.set(key, cur);
    });
  });
  const topSelisih = [...itemSelisihMap.values()]
    .sort((a, b) => b.totalSelisihAbs - a.totalSelisihAbs)
    .slice(0, 8);

  res.json({
    totalOpname: scoped.length,
    perCabang,
    topSelisih
  });
});

module.exports = router;
