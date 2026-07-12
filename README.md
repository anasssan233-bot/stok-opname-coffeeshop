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

## Cara Publish Gratis ke Internet (Neon + Vercel)

Kombinasi ini gratis, tidak perlu kartu kredit, dan **datanya tersimpan permanen** di Neon (server Vercel sendiri tidak menyimpan data, hanya menjalankan kode aplikasinya).

### Langkah 1 — Siapkan database di Neon (kalau belum)
Ikuti langkah "Menjalankan di Laptop/PC" nomor 1 di atas untuk membuat project Neon dan salin **Connection string**-nya. Simpan dulu, akan dipakai di Langkah 3.

### Langkah 2 — Upload project ke GitHub
1. Buat akun GitHub kalau belum punya: [github.com](https://github.com)
2. Buat repository baru (**New repository**), boleh privat
3. Upload semua isi folder project ini ke repo tersebut lewat **Add file > Upload files** (drag semua file & folder, **kecuali folder `node_modules`** kalau ada — tidak perlu diupload, Vercel akan install sendiri)
4. Klik **Commit changes**

### Langkah 3 — Deploy di Vercel
1. Buka **[vercel.com](https://vercel.com)**, klik **Sign Up**, pilih **Continue with GitHub** (tidak perlu kartu kredit untuk paket Hobby/gratis)
2. Di dashboard, klik **Add New...** → **Project**
3. Cari dan pilih repository `stok-opname-coffeeshop` yang tadi diupload, klik **Import**
4. Di halaman konfigurasi:
   - **Framework Preset**: biarkan **Other** (Vercel akan otomatis membaca file `vercel.json` yang sudah disiapkan di project ini)
   - **Root Directory**: biarkan default
5. Buka bagian **Environment Variables**, tambahkan:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon dari Langkah 1 |
   | `SESSION_SECRET` | ketik bebas string acak, misal `kopi-rahasia-2026-xyzabc` |

6. Klik **Deploy**, tunggu proses build selesai (biasanya 1-2 menit)
7. Setelah selesai, Vercel memberi alamat seperti `https://stok-opname-coffeeshop.vercel.app` — itulah alamat website kamu, sudah bisa diakses siapa saja.

### Yang perlu diketahui soal Vercel
- Vercel menjalankan aplikasi ini sebagai *serverless function* (server hanya menyala sesaat per request), jadi **tidak ada jeda "bangun tidur"** seperti di Render/Koyeb — responnya cepat kapan saja diakses.
- Karena semua data (cabang, item, opname, akun) tersimpan di Neon, bukan di server Vercel, data aman meski Vercel menjalankan ulang function-nya di setiap request.
- Paket gratis (Hobby) Vercel cukup untuk pemakaian 3 cabang skala kecil-menengah. Kalau nanti trafiknya sangat tinggi, Vercel akan memberi tahu lewat dashboard kalau perlu upgrade.

### Setelah Deploy
1. Buka alamat `.vercel.app` tadi
2. Login pakai `admin` / `admin123`
3. Coba buat 1 opname baru, cek muncul di Riwayat
4. **Segera ganti password** semua akun contoh lewat Master Data > Akun Staf

### Kalau Ada Error Saat Deploy
- **Build gagal** → buka tab **Deployments** di dashboard Vercel, klik deploy yang gagal untuk lihat detail error di lognya
- **Halaman muncul tapi login gagal terus / error 500** → cek apakah `DATABASE_URL` sudah benar-benar ditempel utuh di Environment Variables (kadang terpotong saat copy-paste), lalu klik **Redeploy**
- Perubahan pada Environment Variables baru berlaku setelah **Redeploy** — bukan otomatis langsung aktif

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
