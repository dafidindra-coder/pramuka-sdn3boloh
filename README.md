# pramuka-sdn3boloh

Aplikasi administrasi kepramukaan SDN 3 Boloh (Gudep 05.093 Putra & 05.122 Putri): absensi, iuran dan kas, uji SKU, data anggota, agenda, dan rekap bulanan.

## Peran
- **Pembina**: absen, iuran, kas keluar, uji SKU, kelola anggota, agenda, rekap Gudep-nya.
- **Mabigus**: ringkasan per Gudep, agenda, rekap semua Gudep.
- **Siswa**: kehadiran, iuran, dan progres SKU miliknya sendiri.

## Pemasangan di Supabase (sekali saja)
1. **Skema baru**: buka Supabase > SQL Editor, tempel isi `supabase/perubahan_skema.sql`, lalu Run.
   Ini menambah kolom anggota (kelas, tingkat, barung, HP orang tua, aktif), tabel `kas_keluar` dan `agenda`, serta aturan aksesnya (RLS).
2. **Fungsi tambah siswa**: pasang Edge Function agar pembina bisa membuat akun siswa dari aplikasi:
   ```
   supabase functions deploy buat-siswa
   ```
   Fungsi ini memakai `service_role` di server, jadi kunci rahasia tidak pernah ada di browser.
3. **Daftar SKU**: sesuaikan `sku.js` dengan buku SKU Siaga resmi yang dipakai Gudep.

## Konfigurasi
Ubah `config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DOMAIN_EMAIL`, dan `IURAN_PER_BULAN`.
