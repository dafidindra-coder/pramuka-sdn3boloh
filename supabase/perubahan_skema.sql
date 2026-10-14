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

-- =====================================================================
-- Tahap 2: pembina dikelola mabigus, butir SKU bisa diubah, pelantikan golongan
-- =====================================================================

-- 6. Kolom tambahan: tingkatan terakhir yang sudah dilantik, dan nomor HP (pembina)
alter table public.profil_pengguna
  add column if not exists tingkat_dilantik text,
  add column if not exists no_hp text;
do $$ begin
  alter table public.profil_pengguna
    add constraint profil_tingkat_dilantik_valid check (tingkat_dilantik is null or tingkat_dilantik in ('mula','bantu','tata'));
exception when duplicate_object then null; end $$;

-- 7. Mabigus boleh mengubah data pembina (nama, Gudep, HP, aktif)
drop policy if exists "mabigus ubah pembina" on public.profil_pengguna;
create policy "mabigus ubah pembina" on public.profil_pengguna
  for update to authenticated
  using      (public.peran_saya() = 'mabigus' and role = 'pembina')
  with check (public.peran_saya() = 'mabigus' and role = 'pembina');

-- 8. Butir SKU (bisa ditambah dan diubah pembina/mabigus; dinonaktifkan, bukan dihapus)
create table if not exists public.materi_sku (
  kode    text primary key,
  tingkat text not null check (tingkat in ('mula','bantu','tata')),
  uraian  text not null,
  urutan  integer not null default 0,
  aktif   boolean not null default true
);
alter table public.materi_sku enable row level security;
drop policy if exists "materi_sku baca"  on public.materi_sku;
drop policy if exists "materi_sku tulis" on public.materi_sku;
drop policy if exists "materi_sku ubah"  on public.materi_sku;
create policy "materi_sku baca" on public.materi_sku for select to authenticated using (true);
create policy "materi_sku tulis" on public.materi_sku for insert to authenticated
  with check (public.peran_saya() in ('pembina','mabigus'));
create policy "materi_sku ubah" on public.materi_sku for update to authenticated
  using (public.peran_saya() in ('pembina','mabigus')) with check (public.peran_saya() in ('pembina','mabigus'));

-- Isi awal (CONTOH, sama dengan sku.js) — ubah lewat menu SKU > Kelola butir
insert into public.materi_sku (kode, tingkat, uraian, urutan) values
 ('M-01','mula','Taat menjalankan ibadah agamanya',1),('M-02','mula','Hafal Dwi Satya dan Dwi Darma',2),
 ('M-03','mula','Mengenal bendera Merah Putih dan cara menghormatinya',3),('M-04','mula','Hafal lagu Indonesia Raya',4),
 ('M-05','mula','Menyebutkan nama presiden dan wakil presiden',5),('M-06','mula','Mengenal dan melakukan salam Pramuka',6),
 ('M-07','mula','Hafal alamat rumah dan nama orang tua',7),('M-08','mula','Membuat simpul mati dan simpul hidup',8),
 ('M-09','mula','Menjaga kebersihan diri (gosok gigi, cuci tangan)',9),('M-10','mula','Melakukan baris-berbaris dasar (siap, istirahat)',10),
 ('B-01','bantu','Hafal doa sebelum dan sesudah kegiatan',1),('B-02','bantu','Memahami isi Dwi Darma',2),
 ('B-03','bantu','Hafal lagu Padamu Negeri dan Hari Merdeka',3),('B-04','bantu','Menyebutkan sila-sila Pancasila',4),
 ('B-05','bantu','Membuat simpul pangkal dan simpul anyam',5),('B-06','bantu','Mengenal tanda barung dan tanda tingkatan Siaga',6),
 ('B-07','bantu','Berhitung uang sampai Rp 100.000',7),('B-08','bantu','Membantu pekerjaan di rumah',8),
 ('B-09','bantu','Mengenal P3K sederhana (plester, obat luka)',9),('B-10','bantu','Menyanyikan dua lagu daerah',10),
 ('T-01','tata','Menjelaskan arti lambang Tunas Kelapa',1),('T-02','tata','Menjelaskan arti lambang Garuda Pancasila',2),
 ('T-03','tata','Mengenal sandi morse huruf A–J',3),('T-04','tata','Membuat tandu sederhana dari tongkat dan tali',4),
 ('T-05','tata','Mengenal delapan arah mata angin',5),('T-06','tata','Memimpin barung dalam permainan',6),
 ('T-07','tata','Menabung secara teratur',7),('T-08','tata','Menolong teman yang kesulitan',8),
 ('T-09','tata','Lari 50 meter atau ketangkasan sejenis',9),('T-10','tata','Bercerita tentang pahlawan nasional',10)
on conflict (kode) do nothing;

-- 9. Pengajuan pelantikan golongan: pembina mengajukan, mabigus menyetujui atau menolak
create table if not exists public.pengajuan_pelantikan (
  id              uuid primary key default gen_random_uuid(),
  siswa_id        uuid not null references public.profil_pengguna(id) on delete cascade,
  gudep           text not null,
  tingkat         text not null check (tingkat in ('mula','bantu','tata')),
  status          text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  catatan_pembina text,
  catatan_mabigus text,
  diajukan_oleh   uuid default auth.uid(),
  diajukan_pada   timestamptz not null default now(),
  diputus_oleh    uuid,
  diputus_pada    timestamptz
);
create unique index if not exists pengajuan_satu_menunggu
  on public.pengajuan_pelantikan (siswa_id, tingkat) where status = 'menunggu';
alter table public.pengajuan_pelantikan enable row level security;
drop policy if exists "pelantikan baca"  on public.pengajuan_pelantikan;
drop policy if exists "pelantikan ajukan" on public.pengajuan_pelantikan;
create policy "pelantikan baca" on public.pengajuan_pelantikan for select to authenticated
  using (public.peran_saya() = 'mabigus' or (public.peran_saya() = 'pembina' and gudep = public.gudep_saya()) or siswa_id = auth.uid());
create policy "pelantikan ajukan" on public.pengajuan_pelantikan for insert to authenticated
  with check (public.peran_saya() = 'pembina' and gudep = public.gudep_saya() and status = 'menunggu'
    and exists (select 1 from public.profil_pengguna s where s.id = siswa_id and s.role = 'siswa' and s.gudep = public.gudep_saya()));

-- Keputusan mabigus: satu langkah yang mengubah status pengajuan sekaligus tingkatan siswa
create or replace function public.putuskan_pelantikan(p_id uuid, p_setuju boolean, p_catatan text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.pengajuan_pelantikan;
begin
  if public.peran_saya() is distinct from 'mabigus' then raise exception 'Hanya mabigus yang boleh memutuskan pelantikan'; end if;
  select * into r from public.pengajuan_pelantikan where id = p_id for update;
  if not found or r.status <> 'menunggu' then raise exception 'Pengajuan tidak ditemukan atau sudah diputuskan'; end if;
  update public.pengajuan_pelantikan
     set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         catatan_mabigus = p_catatan, diputus_oleh = auth.uid(), diputus_pada = now()
   where id = p_id;
  if p_setuju then
    update public.profil_pengguna
       set tingkat_dilantik = r.tingkat,
           tingkat = case r.tingkat when 'mula' then 'bantu' when 'bantu' then 'tata' else 'tata' end
     where id = r.siswa_id;
  end if;
end $$;
revoke all on function public.putuskan_pelantikan(uuid, boolean, text) from public, anon;
grant execute on function public.putuskan_pelantikan(uuid, boolean, text) to authenticated;
