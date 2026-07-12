const express = require('express');
const PDFDocument = require('pdfkit');
const { pool, nextId } = require('../db');
const { requireAuth } = require('./authGuard');
const asyncHandler = require('./asyncHandler');

const router = express.Router();
router.use(requireAuth);

// GET /api/opname?cabangId=&from=&to=
router.get('/', asyncHandler(async (req, res) => {
  const { cabangId, from, to } = req.query;
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') {
    params.push(req.user.cabangId);
    conditions.push(`"cabangId" = $${params.length}`);
  } else if (cabangId) {
    params.push(cabangId);
    conditions.push(`"cabangId" = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`tanggal >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`tanggal <= $${params.length}`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    `SELECT * FROM opname ${where} ORDER BY "createdAt" DESC`, params
  );

  const summary = rows.map(o => {
    const details = o.details;
    const totalSelisih = details.reduce((s, d) => s + Math.abs(d.selisih), 0);
    const jumlahBeda = details.filter(d => d.selisih !== 0).length;
    return {
      id: o.id, cabangId: o.cabangId, cabangNama: o.cabangNama, tanggal: o.tanggal,
      userNama: o.userNama, jumlahItem: details.length, jumlahBeda,
      totalSelisihAbs: totalSelisih, createdAt: o.createdAt
    };
  });
  res.json(summary);
}));

// GET /api/opname/:id -> detail lengkap
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM opname WHERE id = $1', [req.params.id]);
  const o = rows[0];
  if (!o) return res.status(404).json({ error: 'Data opname tidak ditemukan' });
  if (req.user.role !== 'admin' && o.cabangId !== req.user.cabangId) {
    return res.status(403).json({ error: 'Tidak punya akses ke data cabang ini' });
  }
  res.json(o);
}));

// POST /api/opname -> buat entri opname baru
router.post('/', asyncHandler(async (req, res) => {
  const { cabangId, tanggal, details, catatan } = req.body || {};
  if (!tanggal || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: 'Tanggal dan minimal satu item stok wajib diisi' });
  }

  let targetCabangId = cabangId;
  if (req.user.role !== 'admin') {
    targetCabangId = req.user.cabangId;
  }
  if (!targetCabangId) return res.status(400).json({ error: 'Cabang wajib dipilih' });

  const cabangRes = await pool.query('SELECT * FROM cabang WHERE id = $1', [targetCabangId]);
  const cabang = cabangRes.rows[0];
  if (!cabang) return res.status(400).json({ error: 'Cabang tidak valid' });

  const itemsRes = await pool.query('SELECT * FROM items WHERE "cabangId" = $1', [targetCabangId]);
  const itemMap = new Map(itemsRes.rows.map(i => [i.id, i]));

  const cleanDetails = details.map(d => {
    const item = itemMap.get(d.itemId);
    const stokSistem = Number(d.stokSistem) || 0;
    const stokFisik = Number(d.stokFisik) || 0;
    return {
      itemId: d.itemId,
      itemNama: item ? item.nama : (d.itemNama || 'Item tidak dikenal'),
      satuan: item ? item.satuan : (d.satuan || ''),
      stokSistem, stokFisik,
      selisih: Number((stokFisik - stokSistem).toFixed(3)),
      keterangan: d.keterangan || ''
    };
  });

  const id = await nextId('op');
  const createdAt = new Date().toISOString();
  const entry = {
    id, cabangId: targetCabangId, cabangNama: cabang.nama, tanggal,
    userId: req.user.id, userNama: req.user.nama, catatan: catatan || '',
    details: cleanDetails, createdAt
  };

  await pool.query(
    `INSERT INTO opname (id, "cabangId", "cabangNama", tanggal, "userId", "userNama", catatan, details, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, targetCabangId, cabang.nama, tanggal, req.user.id, req.user.nama, catatan || '', JSON.stringify(cleanDetails), createdAt]
  );
  res.json(entry);
}));

// ---------- Helper cetak struk 58mm ----------
const MM_TO_PT = 2.83465;
const PAGE_WIDTH = 58 * MM_TO_PT;   // ~164.4pt
const MARGIN = 6;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE = 8;
const FONT_SIZE_SMALL = 7;
const LINE_H = 10;

function fmtNumPdf(n) {
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function fmtDatePdf(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildOpnamePdf(o) {
  const headerLines = 7;
  const perItemLines = 3;
  const footerLines = 5 + (o.catatan ? 3 : 0);
  const estLines = headerLines + o.details.length * perItemLines + footerLines;
  const pageHeight = MARGIN * 2 + estLines * LINE_H + 40;

  const doc = new PDFDocument({
    size: [PAGE_WIDTH, pageHeight],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
  });

  const center = (text, size = FONT_SIZE) => {
    doc.font('Courier-Bold').fontSize(size);
    doc.text(text, { width: CONTENT_WIDTH, align: 'center' });
  };
  const line = (ch = '-') => {
    doc.font('Courier').fontSize(FONT_SIZE);
    const charW = doc.widthOfString(ch);
    const count = Math.floor(CONTENT_WIDTH / charW);
    doc.text(ch.repeat(count));
  };
  const row = (label, value) => {
    doc.font('Courier').fontSize(FONT_SIZE);
    doc.text(`${label}: ${value}`, { width: CONTENT_WIDTH });
  };

  center('STOK OPNAME', 9);
  center(o.cabangNama);
  doc.moveDown(0.2);
  line('=');
  row('Tanggal', fmtDatePdf(o.tanggal));
  row('Oleh', o.userNama);
  row('Dicetak', new Date().toLocaleString('id-ID'));
  line('-');

  doc.font('Courier').fontSize(FONT_SIZE_SMALL);
  o.details.forEach((d, idx) => {
    doc.font('Courier-Bold').fontSize(FONT_SIZE_SMALL);
    doc.text(`${idx + 1}. ${d.itemNama}`, { width: CONTENT_WIDTH });
    doc.font('Courier').fontSize(FONT_SIZE_SMALL);
    const sist = `Sis:${fmtNumPdf(d.stokSistem)}`;
    const fis = `Fis:${fmtNumPdf(d.stokFisik)}`;
    const sel = `Sel:${d.selisih > 0 ? '+' : ''}${fmtNumPdf(d.selisih)}`;
    doc.text(`  ${sist}  ${fis}  ${sel} ${d.satuan}`, { width: CONTENT_WIDTH });
    if (d.keterangan) {
      doc.text(`  Ket: ${d.keterangan}`, { width: CONTENT_WIDTH });
    }
  });

  line('-');
  if (o.catatan) {
    doc.font('Courier-Bold').fontSize(FONT_SIZE_SMALL).text('Catatan:', { width: CONTENT_WIDTH });
    doc.font('Courier').fontSize(FONT_SIZE_SMALL).text(o.catatan, { width: CONTENT_WIDTH });
    line('-');
  }
  const totalBeda = o.details.filter(d => d.selisih !== 0).length;
  doc.font('Courier-Bold').fontSize(FONT_SIZE);
  doc.text(`Total item: ${o.details.length}  |  Selisih: ${totalBeda}`, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  center('-- Terima kasih --', 7);

  doc.end();
  return doc;
}

// GET /api/opname/:id/pdf -> unduh struk PDF format 58mm
router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM opname WHERE id = $1', [req.params.id]);
  const o = rows[0];
  if (!o) return res.status(404).json({ error: 'Data opname tidak ditemukan' });
  if (req.user.role !== 'admin' && o.cabangId !== req.user.cabangId) {
    return res.status(403).json({ error: 'Tidak punya akses ke data cabang ini' });
  }
  const safeName = `opname-${o.cabangNama}-${o.tanggal}`.replace(/[^a-z0-9-_]/gi, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  const doc = buildOpnamePdf(o);
  doc.pipe(res);
}));

module.exports = router;
