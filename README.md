# pramuka-sdn3boloh

Aplikasi administrasi kepramukaan SDN 3 Boloh (Gudep 05.093 Putra & 05.122 Putri): absensi, iuran dan kas, uji SKU, data anggota, agenda, dan rekap bulanan.

## Peran
- **Pembina**: absen, iuran, kas keluar, uji SKU, tambah/ubah butir SKU, tambah/ubah siswa, lihat barung, ajukan pelantikan, agenda, rekap Gudep-nya.
- **Mabigus**: tambah/ubah pembina, lihat barung semua Gudep, setujui atau tolak pelantikan golongan, agenda, rekap semua Gudep.
- **Siswa**: kehadiran, iuran, tingkatan, dan progres SKU miliknya sendiri.

Golongan yang didukung: **Siaga** (Mula, Bantu, Tata; berkelompok dalam barung) dan **Penggalang Ramu** (berkelompok dalam regu).

## Pemasangan di Supabase (sekali saja)
Ikuti **[supabase/PANDUAN.md](supabase/PANDUAN.md)** langkah demi langkah. Ringkasnya:
1. Jalankan `supabase/perubahan_skema.sql` di SQL Editor (struktur tabel + aturan akses).
2. Buat user mabigus di Authentication, lalu jalankan `supabase/akun_pertama.sql`.
3. Deploy Edge Function `buat-akun` (`supabase/functions/buat-akun/index.ts`).
4. Matikan pendaftaran umum, periksa kunci di `config.js`, lalu terbitkan lewat GitHub Pages.

## Alur pelantikan golongan
Pembina mencentang butir SKU siswa → setelah semua butir tingkatannya lulus, siswa muncul di Anggota › Pelantikan →
pembina mengajukan → mabigus menyetujui atau menolak di menu Pelantikan → bila disetujui, tingkatan siswa naik otomatis.

## Konfigurasi
Ubah `config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DOMAIN_EMAIL`, dan `IURAN_PER_BULAN`.

## Memperbarui aplikasi
Setiap kali mengubah file `.js` atau `.css`, naikkan angka `?v=` di semua file `.html`
(mis. `?v=20261020` menjadi tanggal hari ini) agar browser pengguna mengambil versi baru, bukan salinan lama dari cache.
