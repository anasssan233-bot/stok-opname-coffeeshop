require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');

const { pool, initDb } = require('./db');
const authRoutes = require('./routes/auth');
const masterRoutes = require('./routes/master');
const opnameRoutes = require('./routes/opname');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// Vercel ada di belakang proxy HTTPS -> perlu ini supaya cookie sesi aman berfungsi benar
app.set('trust proxy', 1);

// Siapkan/pastikan tabel & data awal database sekali saat aplikasi start.
// Di Vercel ini berjalan saat "cold start" pertama kali function dipanggil.
const dbReady = initDb().catch((err) => {
  console.error('Gagal menyiapkan database:', err.message);
  throw err;
});
// PENTING: tanpa baris ini, "dbReady" adalah Promise yang reject tapi belum ada yang
// menangkapnya di scope module (baru ditangkap nanti di dalam middleware, per-request).
// Node.js menganggap itu "unhandled rejection" pada saat cold start dan MEMATIKAN
// seluruh proses -- inilah penyebab sebenarnya di balik "FUNCTION_INVOCATION_FAILED".
// .catch(() => {}) di sini menandai rejection-nya sudah "ditangani" sejak awal,
// sementara promise yang sama tetap bisa di-await lagi (dan tetap reject) oleh middleware di bawah.
dbReady.catch(() => {});

// Semua request menunggu database siap dulu sebelum diproses
app.use((req, res, next) => {
  dbReady.then(() => next()).catch(() => res.status(500).json({ error: 'Database belum siap, coba lagi sesaat lagi' }));
});

app.use(express.json());
app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'stok-opname-coffeeshop-secret-key-ganti-ini',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 jam
    secure: IS_VERCEL,
    sameSite: 'lax'
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api', masterRoutes);
app.use('/api/opname', opnameRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jaring pengaman terakhir: kalau ada error yang lolos dari semua route (query database gagal,
// bug tak terduga, dll), tangkap di sini dan balas dengan response JSON yang rapi --
// supaya SATU request yang error tidak menjatuhkan seluruh function di Vercel.
// Middleware error HARUS didaftarkan paling akhir dan punya 4 parameter (err, req, res, next).
app.use((err, req, res, next) => {
  console.error('Error tak tertangani:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

// Jalankan sebagai server biasa HANYA kalau file ini dijalankan langsung (npm start / node server.js).
// Kalau file ini di-"require" oleh platform serverless seperti Vercel, bagian ini dilewati --
// Vercel akan memanggil "app" yang di-export di baris paling bawah sebagai function.
if (require.main === module) {
  dbReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Stok Opname app jalan di http://localhost:${PORT}`);
        console.log('Login default -> admin/admin123 | staff1/staff123 | staff2/staff123 | staff3/staff123');
      });
    })
    .catch(() => process.exit(1));
}

module.exports = app;
