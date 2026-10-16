# Panduan menyambungkan aplikasi ke Supabase

Lakukan berurutan. Semua langkah dikerjakan di https://supabase.com/dashboard, proyek **rdilqnpfbszwvktzmxts**.

## 1. Cadangkan data (bila database sudah berisi data)
Database > Backups, atau jalankan di SQL Editor lalu simpan hasilnya:
```sql
select * from profil_pengguna;
```

## 2. Pasang struktur database
1. Buka **SQL Editor** > **New query**.
2. Salin seluruh isi `supabase/perubahan_skema.sql`, tempel, lalu klik **Run**.
3. Di bagian bawah muncul tabel pemeriksaan: harus ada **8 baris**, kolom `rls` bernilai `true`, dan `jumlah_aturan` 2 atau 3.

File ini aman dijalankan berulang dan tidak menghapus data. Yang dihapus hanya **aturan akses (RLS) lama** pada 8 tabel aplikasi, lalu diganti aturan baru yang lengkap.

**Bila muncul error `could not create unique index ... is duplicated`**: ada data ganda dari versi lama. Hapus duplikatnya, lalu Run lagi. Contoh untuk absensi:
```sql
delete from absensi_mingguan a using absensi_mingguan b
where a.ctid < b.ctid and a.siswa_id = b.siswa_id and a.tanggal = b.tanggal;
```
(Untuk iuran ganti kolomnya menjadi `siswa_id, tahun`; untuk SKU `siswa_id, kode_sku`.)

## 3. Buat akun mabigus pertama
1. **Authentication** > **Users** > **Add user** > **Create new user**
   - Email: `NIP-mabigus@sdn3boloh.sch.id` (contoh `197001011995@sdn3boloh.sch.id`)
   - Password: kata sandi pilihan Anda
   - Centang **Auto Confirm User**
2. Buka `supabase/akun_pertama.sql`, ganti email dan `NAMA MABIGUS`, tempel di SQL Editor, lalu **Run**.
   Hasil pemeriksaan harus menampilkan satu baris dengan `role = mabigus`.

Akun pembina dibuat mabigus dari aplikasi (menu **Pembina**), dan akun siswa dibuat pembina (menu **Anggota**).

## 4. Pasang Edge Function `buat-akun`
Fungsi ini membuat akun login baru. Kuncinya (`service_role`) hanya ada di server Supabase, tidak pernah di browser.

**Cara A — lewat Dashboard (tanpa instal apa pun):**
1. **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nama fungsi: `buat-akun` (harus persis).
3. Hapus contoh kode, tempel seluruh isi `supabase/functions/buat-akun/index.ts`, lalu **Deploy**.
4. Biarkan pengaturan **Verify JWT** menyala.

**Cara B — lewat terminal:**
```bash
npx supabase login
npx supabase link --project-ref rdilqnpfbszwvktzmxts
npx supabase functions deploy buat-akun
```

## 5. Atur login
**Authentication** > **Sign In / Providers**:
- **Email**: tetap aktif.
- **Allow new users to sign up**: **matikan**. Semua akun dibuat dari aplikasi oleh mabigus/pembina, jadi pendaftaran umum tidak diperlukan.

## 6. Periksa kunci di `config.js`
**Project Settings** > **API**: cocokkan dengan isi `config.js`.
- `SUPABASE_URL` = Project URL (`https://rdilqnpfbszwvktzmxts.supabase.co`, tanpa garis miring di akhir).
- `SUPABASE_ANON_KEY` = kunci **anon public** (atau **Publishable key**). **Jangan** pernah memakai `service_role` / secret key.

## 7. Terbitkan aplikasi
1. Gabungkan (merge) branch perubahan ke `main` di GitHub.
2. Repo > **Settings** > **Pages** > Source: **Deploy from a branch** > `main` / `(root)` > **Save**.
3. Setelah 1–2 menit aplikasi bisa dibuka di `https://dafidindra-coder.github.io/pramuka-sdn3boloh/`.

## 8. Uji coba
1. Masuk sebagai **mabigus** (NIP + kata sandi dari langkah 3).
2. Menu **Pembina** > **Tambah pembina** untuk Gudep Putra dan Putri.
3. Keluar, masuk sebagai **pembina** > **Anggota** > **Tambah siswa**.
4. Coba absen, iuran, dan centang butir SKU.
5. Masuk sebagai **siswa** untuk memastikan ia hanya melihat datanya sendiri.

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| "Tabel atau kolom baru belum dibuat" | Langkah 2 belum dijalankan | Jalankan `perubahan_skema.sql` |
| "Fungsi buat-akun belum dipasang" | Langkah 4 belum | Deploy Edge Function |
| "NIS/NIP atau kata sandi salah" | Email di Supabase tidak sama dengan `NIP@sdn3boloh.sch.id` | Periksa di Authentication > Users |
| Setelah login kembali ke halaman masuk dengan pesan profil | User ada tetapi belum punya profil | Jalankan `akun_pertama.sql` (atau bagian opsionalnya) |
| "Akun ini sudah dinonaktifkan" | Kolom `aktif` = false | Aktifkan lagi dari menu Pembina / Anggota |
