const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  // PENTING: jangan pernah panggil process.exit() di lingkungan serverless (Vercel dkk).
  // Itu langsung mematikan seluruh proses runtime dan dilaporkan sebagai "function crashed",
  // bukan error biasa. Melempar Error di sini jauh lebih aman -- bisa ditangkap normal oleh
  // .catch() di server.js dan dikembalikan sebagai response error yang rapi ke klien.
  throw new Error(
    'DATABASE_URL belum diset. Buat database Postgres gratis di neon.tech, ' +
    'lalu tambahkan DATABASE_URL di Environment Variables (Vercel) atau file .env (lokal).'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cabang (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      alamat TEXT DEFAULT ''
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      "cabangId" TEXT REFERENCES cabang(id) ON DELETE CASCADE,
      nama TEXT NOT NULL,
      satuan TEXT NOT NULL,
      kategori TEXT DEFAULT 'Lainnya'
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      role TEXT NOT NULL,
      "cabangId" TEXT REFERENCES cabang(id),
      "passwordHash" TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS opname (
      id TEXT PRIMARY KEY,
      "cabangId" TEXT REFERENCES cabang(id),
      "cabangNama" TEXT,
      tanggal TEXT NOT NULL,
      "userId" TEXT,
      "userNama" TEXT,
      catatan TEXT DEFAULT '',
      details JSONB NOT NULL,
      "createdAt" TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value INT NOT NULL
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM cabang');
  if (rows[0].c === 0) {
    await seed();
    console.log('Database kosong terdeteksi -> berhasil diisi data awal (3 cabang contoh).');
  }
}

async function nextId(prefix) {
  const { rows } = await pool.query(
    `INSERT INTO meta (key, value) VALUES ('nextId', 1000)
     ON CONFLICT (key) DO UPDATE SET value = meta.value + 1
     RETURNING value`
  );
  return `${prefix}${rows[0].value}`;
}

async function seed() {
  await pool.query(
    `INSERT INTO cabang (id, nama, alamat) VALUES
     ('cb1', 'Cabang 1 - Pusat', ''),
     ('cb2', 'Cabang 2', ''),
     ('cb3', 'Cabang 3', '')`
  );

  const itemRows = [
    // umum di ketiga cabang
    ['it1', 'cb1', 'Kopi Arabica', 'kg', 'Bahan Baku'],
    ['it2', 'cb1', 'Kopi Robusta', 'kg', 'Bahan Baku'],
    ['it3', 'cb1', 'Susu UHT Full Cream', 'liter', 'Bahan Baku'],
    ['it4', 'cb1', 'Cup 12oz + Lid', 'pcs', 'Kemasan'],
    ['it5', 'cb1', 'Cup 16oz + Lid', 'pcs', 'Kemasan'],
    ['it6', 'cb1', 'Sedotan', 'pcs', 'Kemasan'],
    ['it7', 'cb1', 'Tissue', 'pack', 'Consumable'],
    ['it8', 'cb1', 'Syrup Vanilla', 'botol', 'Bahan Baku'],
    ['it9', 'cb1', 'Syrup Caramel', 'botol', 'Bahan Baku'],
    ['it10', 'cb1', 'Whipped Cream', 'kaleng', 'Bahan Baku'],

    ['it11', 'cb2', 'Kopi Arabica', 'kg', 'Bahan Baku'],
    ['it12', 'cb2', 'Kopi Robusta', 'kg', 'Bahan Baku'],
    ['it13', 'cb2', 'Susu UHT Full Cream', 'liter', 'Bahan Baku'],
    ['it14', 'cb2', 'Cup 12oz + Lid', 'pcs', 'Kemasan'],
    ['it15', 'cb2', 'Cup 16oz + Lid', 'pcs', 'Kemasan'],
    ['it16', 'cb2', 'Sedotan', 'pcs', 'Kemasan'],
    ['it17', 'cb2', 'Tissue', 'pack', 'Consumable'],
    ['it18', 'cb2', 'Gula Aren Cair', 'liter', 'Bahan Baku'],
    ['it19', 'cb2', 'Teh Celup', 'box', 'Bahan Baku'],
    ['it20', 'cb2', 'Paper Bag', 'pcs', 'Kemasan'],

    ['it21', 'cb3', 'Kopi Arabica', 'kg', 'Bahan Baku'],
    ['it22', 'cb3', 'Kopi Robusta', 'kg', 'Bahan Baku'],
    ['it23', 'cb3', 'Susu UHT Full Cream', 'liter', 'Bahan Baku'],
    ['it24', 'cb3', 'Cup 12oz + Lid', 'pcs', 'Kemasan'],
    ['it25', 'cb3', 'Cup 16oz + Lid', 'pcs', 'Kemasan'],
    ['it26', 'cb3', 'Sedotan', 'pcs', 'Kemasan'],
    ['it27', 'cb3', 'Tissue', 'pack', 'Consumable'],
    ['it28', 'cb3', 'Plastik Sealer', 'roll', 'Consumable'],
    ['it29', 'cb3', 'Bubuk Cokelat', 'kg', 'Bahan Baku'],
    ['it30', 'cb3', 'Es Batu Kristal', 'kg', 'Bahan Baku']
  ];
  for (const [id, cabangId, nama, satuan, kategori] of itemRows) {
    await pool.query(
      `INSERT INTO items (id, "cabangId", nama, satuan, kategori) VALUES ($1,$2,$3,$4,$5)`,
      [id, cabangId, nama, satuan, kategori]
    );
  }

  const users = [
    ['u1', 'admin', 'Owner / Admin Pusat', 'admin', null, 'admin123'],
    ['u2', 'staff1', 'Staf Cabang 1', 'staff', 'cb1', 'staff123'],
    ['u3', 'staff2', 'Staf Cabang 2', 'staff', 'cb2', 'staff123'],
    ['u4', 'staff3', 'Staf Cabang 3', 'staff', 'cb3', 'staff123']
  ];
  for (const [id, username, nama, role, cabangId, plainPass] of users) {
    const passwordHash = bcrypt.hashSync(plainPass, 8);
    await pool.query(
      `INSERT INTO users (id, username, nama, role, "cabangId", "passwordHash") VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, username, nama, role, cabangId, passwordHash]
    );
  }

  await pool.query(`INSERT INTO meta (key, value) VALUES ('nextId', 1000) ON CONFLICT DO NOTHING`);
}

module.exports = { pool, initDb, nextId };
