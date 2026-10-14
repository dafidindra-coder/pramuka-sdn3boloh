# pramuka-sdn3boloh

Aplikasi administrasi kepramukaan SDN 3 Boloh (Gudep 05.093 Putra & 05.122 Putri): absensi, iuran dan kas, uji SKU, data anggota, agenda, dan rekap bulanan.

## Peran
- **Pembina**: absen, iuran, kas keluar, uji SKU, tambah/ubah butir SKU, tambah/ubah siswa, lihat barung, ajukan pelantikan, agenda, rekap Gudep-nya.
- **Mabigus**: tambah/ubah pembina, lihat barung semua Gudep, setujui atau tolak pelantikan golongan, agenda, rekap semua Gudep.
- **Siswa**: kehadiran, iuran, tingkatan, dan progres SKU miliknya sendiri.

## Pemasangan di Supabase (sekali saja)
1. **Skema baru**: buka Supabase > SQL Editor, tempel isi `supabase/perubahan_skema.sql`, lalu Run.
   Ini menambah kolom anggota, tabel `kas_keluar`, `agenda`, `materi_sku`, `pengajuan_pelantikan`,
   fungsi `putuskan_pelantikan`, serta aturan aksesnya (RLS).
2. **Fungsi buat akun**: pasang Edge Function agar pembina bisa membuat akun siswa dan mabigus bisa membuat akun pembina:
   ```
   supabase functions deploy buat-akun
   ```
   Fungsi ini memakai `service_role` di server, jadi kunci rahasia tidak pernah ada di browser.
3. **Butir SKU**: isi awal di database masih contoh. Sesuaikan dengan buku SKU Siaga resmi lewat menu SKU › Kelola butir SKU.

## Alur pelantikan golongan
Pembina mencentang butir SKU siswa → setelah semua butir tingkatannya lulus, siswa muncul di Anggota › Pelantikan →
pembina mengajukan → mabigus menyetujui atau menolak di menu Pelantikan → bila disetujui, tingkatan siswa naik otomatis.

## Konfigurasi
Ubah `config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DOMAIN_EMAIL`, dan `IURAN_PER_BULAN`.
