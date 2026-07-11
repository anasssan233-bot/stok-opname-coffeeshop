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

app.use(express.json());
app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'stok-opname-coffeeshop-secret-key-ganti-ini',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12 jam
}));

app.use('/api/auth', authRoutes);
app.use('/api', masterRoutes);
app.use('/api/opname', opnameRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Stok Opname app jalan di http://localhost:${PORT}`);
      console.log('Login default -> admin/admin123 | staff1/staff123 | staff2/staff123 | staff3/staff123');
    });
  })
  .catch((err) => {
    console.error('Gagal menyiapkan database:', err.message);
    process.exit(1);
  });
