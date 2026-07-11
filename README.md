# Aplikasi Stok Opname — Coffee Shop (3 Cabang)

Aplikasi web untuk mencatat dan merekap stok opname harian di 3 cabang coffee shop.
Data tersimpan permanen di database **Postgres** (bisa pakai [Neon](https://neon.tech), gratis selamanya),
sehingga aman meski server sempat "tidur" atau di-restart.

## Fitur
- Login berbeda untuk **staf cabang** (hanya lihat & input data cabangnya sendiri) dan **admin/owner pusat** (lihat & rekap semua cabang).
- **Setiap cabang punya daftar item stok sendiri-sendiri** — item Cabang 1, Cabang 2, dan Cabang 3 bisa sama sekali berbeda, dikelola terpisah lewat Master Data.
- Input stok opname harian: bandingkan stok sistem vs stok fisik, selisih dihitung otomatis, daftar item otomatis menyesuaikan cabang yang sedang dipilih.
- Riwayat opname per cabang, bisa difilter tanggal (dan cabang untuk admin).
- **Download PDF struk opname** ukuran 58mm (format printer kasir/thermal).
- **Cetak langsung ke printer kasir 58mm** dari browser (tombol "Cetak Struk").
- Dashboard rekap: jumlah opname, selisih terakhir per cabang, item yang paling sering selisih.
- Master data (khusus admin): kelola daftar cabang, daftar item/bahan **per cabang**, dan akun staf.

---

## Menjalankan di Laptop/PC (untuk coba-coba dulu)

1. Buat database Postgres gratis di **[neon.tech](https://neon.tech)** (tanpa kartu kredit, tidak ada batas waktu):
   - Daftar/masuk, klik **New Project**
   - Setelah project dibuat, salin **Connection string** yang muncul (formatnya seperti `postgresql://user:pass@ep-xxx.aws.neon.tech/dbname?sslmode=require`)
2. Di folder project ini, salin file `.env.example` menjadi `.env`:
   ```
   cp .env.example .env
   ```
   Lalu buka `.env` dan tempel connection string Neon tadi ke `DATABASE_URL`.
3. Install dependency:
   ```
   npm install
   ```
4. Jalankan aplikasi:
   ```
   npm start
   ```
   Saat pertama kali jalan, tabel & data contoh akan otomatis dibuat di database Neon kamu.
5. Buka browser ke **http://localhost:3000**

## Akun Login Default (contoh)

| Username | Password  | Peran               | Cabang     |
|----------|-----------|---------------------|------------|
| admin    | admin123  | Admin / Owner Pusat | Semua      |
| staff1   | staff123  | Staf                | Cabang 1   |
| staff2   | staff123  | Staf                | Cabang 2   |
| staff3   | staff123  | Staf                | Cabang 3   |

**Segera ganti password ini** lewat menu Master Data > Akun Staf setelah login pertama kali (hapus akun lama, buat akun baru dengan password sendiri).

---

## Cara Publish Gratis ke Internet (Neon + Render)

Kombinasi ini gratis dan **datanya benar-benar tersimpan permanen** — cocok untuk tahap demo maupun pemakaian harian skala kecil.

> Kenapa bukan Vercel? Vercel menjalankan server hanya sesaat per request (serverless) dan tidak punya penyimpanan file/data permanen bawaan, jadi kurang cocok untuk aplikasi seperti ini kecuali disambungkan ke database eksternal juga. Render bisa menjalankan server Node.js secara terus-menerus seperti biasa, jadi lebih pas dipasangkan dengan database Neon.

### Langkah 1 — Siapkan database di Neon (kalau belum)
Ikuti langkah "Menjalankan di Laptop/PC" nomor 1 di atas untuk membuat project Neon dan salin **Connection string**-nya. Simpan dulu, akan dipakai di Langkah 3.

### Langkah 2 — Upload project ke GitHub
Render butuh kode di GitHub (gratis) untuk bisa deploy otomatis.
1. Buat akun GitHub kalau belum punya: [github.com](https://github.com)
2. Buat repository baru (New repository), boleh privat
3. Upload semua isi folder project ini ke repo tersebut. Cara termudah lewat browser:
   - Buka halaman repo → **Add file > Upload files** → drag semua file/folder project (kecuali folder `node_modules` — tidak perlu diupload)
   - Klik **Commit changes**

### Langkah 3 — Deploy di Render
1. Daftar/masuk ke **[render.com](https://render.com)** (bisa langsung pakai akun GitHub)
2. Klik **New** → **Web Service**
3. Hubungkan/pilih repository GitHub yang berisi project ini
4. Isi form deploy:
   - **Name**: bebas, misalnya `stok-opname-coffeeshop`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: pilih **Free**
5. Buka bagian **Advanced** / **Environment Variables**, tambahkan:
   - `DATABASE_URL` = connection string Neon dari Langkah 1
   - `SESSION_SECRET` = string acak bebas (contoh: `rahasia-toko-kopi-2026-xyz`)
6. Klik **Create Web Service** dan tunggu proses deploy selesai (beberapa menit)
7. Setelah selesai, Render memberi alamat seperti `https://stok-opname-coffeeshop.onrender.com` — itulah alamat website kamu.

### Yang perlu diketahui soal tier gratis Render
- Server otomatis "tidur" kalau tidak ada yang mengakses selama 15 menit. Saat ada yang buka lagi, butuh sekitar 30–60 detik untuk "bangun" — ini normal, bukan error.
- **Karena kita sudah pakai Neon untuk data (bukan file lokal), data TIDAK akan hilang** meski server tidur/restart. Ini beda dengan setup awal yang pakai file JSON.
- Kalau nanti sudah dipakai serius sehari-hari dan tidak mau ada jeda "bangun tidur" ini, tinggal upgrade instance Render ke paket berbayar (mulai ~$7/bulan) — tidak perlu ubah kode apa pun.

---

## Struktur Data (Database)

Semua data (cabang, item, user, riwayat opname) tersimpan di database Postgres, dengan tabel:
- `cabang` — daftar cabang
- `items` — daftar item stok, masing-masing terhubung ke satu cabang
- `users` — akun staf & admin
- `opname` — catatan hasil stok opname (detail per item disimpan sebagai JSON di kolom `details`)

**Backup**: Neon otomatis menyimpan data di cloud. Untuk backup manual, buka dashboard Neon > pilih project > gunakan fitur *branching* atau ekspor lewat `pg_dump` bila perlu.

## Catatan Keamanan

- Jangan bagikan isi file `.env` atau connection string Neon ke orang lain — itu kunci akses penuh ke database kamu.
- Ganti `SESSION_SECRET` dengan string acak sendiri sebelum dipakai secara nyata / online (jangan pakai contoh di `.env.example`).
- Segera ganti password akun contoh (admin123, staff123) setelah deploy.
