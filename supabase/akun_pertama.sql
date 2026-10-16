-- =====================================================================
-- AKUN MABIGUS PERTAMA
-- Jalankan SETELAH perubahan_skema.sql, dan SETELAH membuat user di
-- Dashboard > Authentication > Users > Add user > Create new user:
--   Email    : <NIP mabigus>@sdn3boloh.sch.id   (contoh: 197001011995@sdn3boloh.sch.id)
--   Password : kata sandi pilihan Anda
--   Centang  : Auto Confirm User
--
-- Lalu ganti dua nilai di bawah (NIP dan nama), dan Run.
-- Akun pembina dan siswa berikutnya dibuat dari aplikasi (menu Pembina / Anggota).
-- =====================================================================
insert into public.profil_pengguna (id, nis_nip, nama, role, gudep, aktif)
select u.id, split_part(u.email, '@', 1), 'NAMA MABIGUS', 'mabigus', null, true
from auth.users u
where u.email = '197001011995@sdn3boloh.sch.id'          -- <<< ganti dengan email NIP mabigus
on conflict (id) do update set role = 'mabigus', nama = excluded.nama, gudep = null, aktif = true;

-- Pemeriksaan: harus muncul satu baris dengan role = mabigus
select id, nis_nip, nama, role, gudep, aktif from public.profil_pengguna where role = 'mabigus';

-- ---------------------------------------------------------------------
-- (Opsional) Bila user lama sudah ada di Authentication tetapi belum punya profil,
-- buat profilnya di sini. Contoh untuk satu pembina Gudep Putra:
-- insert into public.profil_pengguna (id, nis_nip, nama, role, gudep)
-- select id, split_part(email,'@',1), 'Nama Pembina', 'pembina', '05.093'
-- from auth.users where email = '198501012010@sdn3boloh.sch.id'
-- on conflict (id) do nothing;
-- ---------------------------------------------------------------------
