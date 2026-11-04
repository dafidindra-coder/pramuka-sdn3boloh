# Aplikasi Presensi Siswa (QR Code + Firebase)

Aplikasi web untuk presensi siswa dengan scan kartu QR. Berjalan di HP, tablet, atau laptop,
dan dirancang agar tetap di paket gratis Firebase (Spark) untuk sekitar 300 siswa.

## Fitur

- **Peran:** Kepala Sekolah menambah, menonaktifkan, dan menghapus akun guru. Guru dan kepala sekolah
  bisa menambah, mengedit, menghapus, dan mengimpor data siswa.
- **Scan:** semua guru bisa men-scan seluruh siswa. Scan setelah jam masuk otomatis tercatat Terlambat.
  Satu siswa hanya tercatat sekali per hari.
- **Harian:** catat Hadir/Terlambat/Izin/Sakit secara manual (untuk yang lupa kartu, surat izin, dsb.),
  per tanggal dan per kelas. **Laporan harian** bisa diunduh sebagai CSV atau **dicetak**: berkop sekolah
  dengan logo, halaman rekap semua kelas, satu halaman per kelas, dan kolom tanda tangan kepala sekolah serta guru.
- **Laporan:** rekap bulanan yang dikelompokkan per kelas (H, T, I, S, Alpa, persentase kehadiran),
  bisa diunduh sebagai CSV untuk Excel atau dicetak berkop sekolah (setiap kelas di halaman sendiri).
- **Kartu QR:** ukuran KTP, berlogo dan berfoto, berbingkai warna dengan gambar logo sekolah buram sebagai latar
  dan semboyan sekolah di pita bawah (ubah `MOTTO` di awal `public/app.js` bila perlu). Pilih **potret** (tegak 5,4 × 8,6 cm, 9 per A4) atau
  **lanskap** (mendatar 8,6 × 5,4 cm, 10 per A4). Kartu berisi token acak, jadi tidak bisa
  dipalsukan hanya dengan mengetahui NIS. Kartu hilang bisa diganti dan kartu lama otomatis tidak berlaku.
- **Foto siswa:** tampil di kartu QR dan di layar guru saat scan, supaya guru bisa memastikan kartu
  dibawa oleh pemiliknya. Foto diunggah per siswa (menu Siswa → Edit) atau sekaligus lewat **Impor foto**
  (nama file = NIS, misalnya `1001.jpg`). Siswa tanpa foto ditampilkan dengan inisial nama.

## Logo sekolah
Logo tampil di halaman masuk, di kepala aplikasi, di kartu siswa, dan di kop laporan cetak. Untuk
menggantinya, timpa file **`public/logo.png`** (PNG persegi, latar transparan, sekitar 300–400 piksel),
lalu jalankan `firebase deploy` lagi.

## Uji coba lokal tanpa project Firebase

Butuh Node.js dan Java 11+ (untuk emulator Firestore).

```bash
npm install -g firebase-tools
firebase emulators:start --project demo-presensi
```

Buka http://localhost:5000. Selama dibuka dari localhost, aplikasi otomatis memakai emulator
(login dan database palsu di komputer Anda). Data bisa dilihat di http://localhost:4000.

## Cara memasang (sekitar 20 menit)

### 1. Buat project Firebase
1. Buka https://console.firebase.google.com lalu klik **Create a project**. Google Analytics boleh dimatikan.
2. Biarkan di paket **Spark (gratis)**. Jangan hubungkan kartu/billing.

### 2. Aktifkan login email
**Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**

### 3. Buat database
**Build → Firestore Database → Create database.** Pilih lokasi **asia-southeast2 (Jakarta)**
dan mode **production**. Lokasi tidak bisa diubah setelah dipilih.

### 4. Daftarkan aplikasi web
1. **Project settings (ikon gerigi) → General → Your apps → ikon `</>`** (Web). Beri nama bebas.
   Centang Firebase Hosting tidak wajib.
2. Salin isi objek `firebaseConfig` yang ditampilkan ke file **`public/firebase-config.js`**.

### 5. Deploy
Butuh Node.js (https://nodejs.org, versi LTS). Lalu di terminal, di dalam folder ini:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --project ID_PROJECT_ANDA
```

`ID_PROJECT_ANDA` sama dengan `projectId` di firebase-config.js. Perintah ini mengunggah aplikasi
sekaligus aturan keamanan database (`firestore.rules`).

### 6. Siapkan akun kepala sekolah
Buka **https://ID_PROJECT_ANDA.web.app**. Pada kunjungan pertama muncul formulir "Siapkan aplikasi
presensi". Akun yang dibuat di sini menjadi akun kepala sekolah, dan formulir ini tidak akan muncul lagi.

## Cara pakai sehari-hari

1. **Kepala sekolah** menambah guru di menu **Guru**. Atur jam masuk di **Pengaturan**.
2. **Guru** memasukkan siswa di menu **Siswa**, satu per satu atau lewat **Impor dari Excel**
   (tiga kolom: NIS, Nama, Kelas; blok di Excel, salin, tempel).
3. (Opsional) Unggah foto siswa di menu **Siswa → Impor foto**. Beri nama setiap file dengan NIS siswa.
4. Cetak kartu di menu **Kartu QR** per kelas (skala cetak 100%), potong, laminasi.
5. Pagi hari, petugas membuka menu **Scan**, ketuk **Mulai scan**, arahkan kamera ke kartu.
6. Izin/sakit dicatat di menu **Harian**. Pilih tanggal dan kelas, lalu **Cetak laporan** atau **Unduh CSV**.
7. Akhir bulan, buka **Laporan**, pilih bulan, lalu **Unduh Excel (CSV)** atau **Cetak**.

Tips: di HP, buka alamat aplikasi di Chrome lalu pilih menu ⋮ → **Add to Home screen** supaya
terasa seperti aplikasi biasa.

## Cara kerja Alpa
Paket gratis tidak menyediakan Cloud Functions, jadi tidak ada proses otomatis di server.
Setiap tanggal yang pernah ada presensi dicatat sebagai **hari efektif**. Di laporan,
Alpa = hari efektif − (H + T + I + S). Jika ada scan tidak sengaja di hari libur, kepala sekolah
bisa menghapus tanggal itu dari daftar hari efektif di menu Laporan.

## Tetap gratis
- Data siswa disimpan di perangkat dan hanya diunduh ulang bila ada perubahan.
- Foto disimpan di Firestore sebagai JPEG kecil (240 × 300 piksel, ±10–15 KB), bukan di Cloud Storage
  yang membutuhkan paket berbayar. Foto hanya diunduh saat scan (1 baca per siswa) dan saat mencetak kartu.
  300 foto memakai sekitar 4 MB dari kuota penyimpanan gratis 1 GB.
- Rekap bulanan disimpan per siswa, jadi membuka laporan cukup membaca ±300 dokumen.
- Perkiraan pemakaian harian untuk 300 siswa: beberapa ribu baca dan ±1.000 tulis,
  jauh di bawah kuota gratis 50.000 baca dan 20.000 tulis per hari.
- Kuota harian direset tengah malam waktu Pasifik (sekitar pukul 14.00–15.00 WIB).
  Jika kuota habis, aplikasi berhenti sementara hingga reset. Tidak ada tagihan selama billing tidak dihubungkan.
- Pantau di **Firestore Database → Usage**.
- Opsional: aktifkan **App Check** (reCAPTCHA) agar database hanya bisa diakses dari aplikasi ini.

## Catatan
- Scan membutuhkan internet dan alamat **https** (sudah otomatis di `*.web.app`).
- Menghapus guru di aplikasi mencabut aksesnya. Untuk menghapus akun login sepenuhnya,
  hapus juga emailnya di **Authentication → Users**. Ini juga diperlukan jika email yang sama ingin dipakai lagi.
- Jika pembuatan akun kepala sekolah gagal di tengah jalan, hapus email tersebut di
  **Authentication → Users** lalu ulangi langkah 6.
- Setelah memperbarui aplikasi ke versi berfoto, jalankan lagi `firebase deploy` agar aturan database
  untuk foto ikut terpasang. Tanpa itu, unggah foto akan ditolak.
- NIS tidak bisa diubah. Bila salah, hapus siswanya lalu tambahkan lagi (kartu perlu dicetak ulang).
- Siswa yang ditambahkan di tengah bulan dihitung Alpa untuk hari sebelum ia terdaftar.
  Periksa laporannya sebelum dicetak.

## Struktur file
```
public/index.html          tampilan dan gaya (warna mengikuti logo sekolah)
public/logo.png            logo sekolah (boleh diganti)
public/app.js              logika aplikasi
public/firebase-config.js  konfigurasi project Firebase (wajib diisi)
firestore.rules            aturan akses database (peran kepala sekolah/guru, validasi foto)
firebase.json              pengaturan deploy
```

---
Hak cipta © 2026 Dafid Indra Jaya Ningrat. Hak cipta dilindungi.
