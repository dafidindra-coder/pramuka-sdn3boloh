-- =====================================================================
-- Perubahan skema untuk fitur baru (Anggota, SKU per tingkat, Kas keluar, Agenda)
-- Jalankan sekali di Supabase: Dashboard > SQL Editor > New query > tempel > Run.
-- Aman dijalankan ulang. Periksa bagian RLS bila kebijakan Anda yang lama berbeda.
-- =====================================================================

-- 1. Kolom baru di profil_pengguna
alter table public.profil_pengguna
  add column if not exists kelas   text,
  add column if not exists tingkat text not null default 'mula',
  add column if not exists barung  text,
  add column if not exists hp_ortu text,
  add column if not exists aktif   boolean not null default true;

do $$ begin
  alter table public.profil_pengguna
    add constraint profil_tingkat_valid check (tingkat in ('mula','bantu','tata'));
exception when duplicate_object then null; end $$;

-- 2. Fungsi bantu untuk RLS (security definer agar tidak berputar saat membaca profil_pengguna)
create or replace function public.peran_saya() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.profil_pengguna where id = auth.uid() $$;

create or replace function public.gudep_saya() returns text
  language sql stable security definer set search_path = public
  as $$ select gudep from public.profil_pengguna where id = auth.uid() $$;

-- 3. Pembina boleh mengubah data siswa di Gudep-nya sendiri (nama, kelas, tingkat, barung, HP, aktif)
drop policy if exists "pembina ubah siswa gudepnya" on public.profil_pengguna;
create policy "pembina ubah siswa gudepnya" on public.profil_pengguna
  for update to authenticated
  using      (public.peran_saya() = 'pembina' and role = 'siswa' and gudep = public.gudep_saya())
  with check (public.peran_saya() = 'pembina' and role = 'siswa' and gudep = public.gudep_saya());

-- 4. Kas keluar (pengeluaran Gudep)
create table if not exists public.kas_keluar (
  id          uuid primary key default gen_random_uuid(),
  gudep       text not null check (gudep in ('05.093','05.122')),
  tanggal     date not null default current_date,
  keterangan  text not null,
  jumlah      integer not null check (jumlah > 0),
  dibuat_oleh uuid default auth.uid(),
  dibuat_pada timestamptz not null default now()
);
alter table public.kas_keluar enable row level security;

drop policy if exists "kas_keluar baca"  on public.kas_keluar;
drop policy if exists "kas_keluar tulis" on public.kas_keluar;
drop policy if exists "kas_keluar hapus" on public.kas_keluar;
create policy "kas_keluar baca" on public.kas_keluar for select to authenticated
  using (public.peran_saya() = 'mabigus' or (public.peran_saya() = 'pembina' and gudep = public.gudep_saya()));
create policy "kas_keluar tulis" on public.kas_keluar for insert to authenticated
  with check (public.peran_saya() = 'pembina' and gudep = public.gudep_saya());
create policy "kas_keluar hapus" on public.kas_keluar for delete to authenticated
  using (public.peran_saya() = 'pembina' and gudep = public.gudep_saya());

-- 5. Agenda kegiatan (gudep kosong = untuk semua Gudep)
create table if not exists public.agenda (
  id          uuid primary key default gen_random_uuid(),
  gudep       text check (gudep is null or gudep in ('05.093','05.122')),
  tanggal     date not null,
  judul       text not null,
  keterangan  text,
  dibuat_oleh uuid default auth.uid(),
  dibuat_pada timestamptz not null default now()
);
alter table public.agenda enable row level security;

drop policy if exists "agenda baca"  on public.agenda;
drop policy if exists "agenda tulis" on public.agenda;
drop policy if exists "agenda hapus" on public.agenda;
create policy "agenda baca" on public.agenda for select to authenticated
  using (gudep is null or public.peran_saya() = 'mabigus' or gudep = public.gudep_saya());
create policy "agenda tulis" on public.agenda for insert to authenticated
  with check (public.peran_saya() = 'mabigus' or (public.peran_saya() = 'pembina' and gudep = public.gudep_saya()));
create policy "agenda hapus" on public.agenda for delete to authenticated
  using (public.peran_saya() = 'mabigus' or (public.peran_saya() = 'pembina' and gudep = public.gudep_saya()));

-- Catatan SKU: kode materi berubah dari SKU-01..05 (contoh lama) menjadi M-01, B-01, T-01, dst. (lihat sku.js).
-- Data pencapaian dengan kode lama tidak dihapus, tetapi tidak tampil lagi di aplikasi.
