# pramuka-sdn3boloh

Aplikasi administrasi kepramukaan SDN 3 Boloh (Gudep 05.093 Putra & 05.122 Putri): absensi, iuran dan kas, uji SKU, data anggota, agenda, dan rekap bulanan.

## Peran
- **Pembina**: absen, iuran, kas keluar, uji SKU, tambah/ubah butir SKU, tambah siswa laki-laki (Gudep Putra) maupun perempuan (Gudep Putri) secara manual atau impor Excel/CSV (kolom L/P), ubah/hapus siswa Gudep-nya, lihat barung, ajukan pelantikan, agenda, rekap Gudep-nya.
- **Mabigus**: tambah/ubah/hapus pembina, lihat barung semua Gudep, setujui atau tolak pelantikan golongan, agenda, rekap semua Gudep.
- **Siswa**: kehadiran, iuran, tingkatan, dan progres SKU miliknya sendiri.

## Iuran per guru kelas
Mabigus menetapkan kelas untuk pembina yang menjadi guru kelas (menu Pembina › Ubah › "Guru kelas untuk kelas").
Guru kelas mencatat iuran semua siswa di kelasnya, putra maupun putri (kedua Gudep); pembina lain dan mabigus hanya melihat.
Uang iuran disetorkan guru kelas lewat Iuran › Setoran ke kas Gudep siswanya (Putra atau Putri), lalu dikonfirmasi pembina Gudep itu atau mabigus.
Kas Gudep = setoran yang sudah diterima − pengeluaran; sisanya tampil sebagai "masih di guru kelas".

## Absensi dan rekap per kelas
Di menu Absen, pilih kelas untuk mengabsen per kelas. Guru kelas otomatis melihat kelasnya dan boleh mengabsen semua siswa kelas itu (putra dan putri);
pembina tetap bisa mengabsen siswa Gudep-nya. Menu Rekap menampilkan **rekap per kelas** (jumlah siswa L/P, latihan, H/S/I/A, % hadir, iuran masuk)
yang bisa diunduh sebagai CSV; ketuk nama kelas untuk melihat rekap siswanya.
Laporan absensi per kelas (daftar hadir per tanggal latihan, lengkap dengan kop dan tanda tangan) bisa dicetak atau disimpan sebagai PDF
lewat tombol "Cetak PDF" di menu Absen atau "Laporan absensi per kelas (PDF)" di menu Rekap.
Laporan iuran per kelas (centang per bulan, jumlah, tunggakan, dan setoran ke kas) dicetak lewat "Cetak PDF" di menu Iuran
atau "Laporan iuran per kelas (PDF)" di menu Rekap.
Laporan kas Gudep (buku kas: saldo awal, setoran diterima, pengeluaran, saldo akhir) per bulan atau setahun dicetak lewat
Iuran › Kas › "Cetak laporan kas Gudep (PDF)" atau "Laporan kas Gudep (PDF)" di menu Rekap. Aturan aksesnya ada di `supabase/absensi_per_kelas.sql`.

Setiap pengguna punya foto profil yang bisa diganti sendiri dari Beranda.

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

## Aplikasi presensi siswa
Aplikasi presensi siswa berbasis kartu QR (Firebase) sudah dipindah ke repo tersendiri:
https://github.com/dafidindra-coder/presensi-sdn3boloh
