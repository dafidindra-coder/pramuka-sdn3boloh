-- =====================================================================
-- DATABASE APLIKASI PRAMUKA SDN 3 BOLOH
-- Jalankan di Supabase: Dashboard > SQL Editor > New query > tempel seluruh isi file ini > Run.
--
-- Aman dijalankan berulang kali, dan aman untuk database yang sudah berisi data:
--   - tabel yang sudah ada tidak dihapus, hanya ditambah kolom yang belum ada;
--   - aturan akses (RLS) buatan file ini dihapus lalu dibuat ulang dengan nama yang sama.
-- Setelah selesai, lanjutkan dengan supabase/akun_pertama.sql untuk membuat akun mabigus pertama.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel dasar (dibuat hanya bila belum ada)
-- ---------------------------------------------------------------------
create table if not exists public.profil_pengguna (
  id       uuid primary key references auth.users(id) on delete cascade,
  nis_nip  text not null unique,
  nama     text not null,
  role     text not null check (role in ('mabigus','pembina','siswa')),
  gudep    text check (gudep is null or gudep in ('05.093','05.122'))
);

create table if not exists public.absensi_mingguan (
  id       bigint generated always as identity primary key,
  siswa_id uuid not null references public.profil_pengguna(id) on delete cascade,
  tanggal  date not null,
  status   text not null check (status in ('H','S','I','A'))
);

create table if not exists public.iuran_bulanan (
  id       bigint generated always as identity primary key,
  siswa_id uuid not null references public.profil_pengguna(id) on delete cascade,
  tahun    integer not null
);

create table if not exists public.pencapaian_sku (
  id          bigint generated always as identity primary key,
  siswa_id    uuid not null references public.profil_pengguna(id) on delete cascade,
  kode_sku    text not null,
  tanggal     date not null default current_date,
  nip_penguji text
);

-- ---------------------------------------------------------------------
-- 2. Kolom tambahan (ditambah hanya bila belum ada)
-- ---------------------------------------------------------------------
alter table public.profil_pengguna
  add column if not exists kelas            text,
  add column if not exists tingkat          text not null default 'mula',
  add column if not exists tingkat_dilantik text,
  add column if not exists barung           text,
  add column if not exists hp_ortu          text,
  add column if not exists no_hp            text,
  add column if not exists aktif            boolean not null default true;

alter table public.iuran_bulanan
  add column if not exists jan boolean not null default false, add column if not exists feb boolean not null default false,
  add column if not exists mar boolean not null default false, add column if not exists apr boolean not null default false,
  add column if not exists mei boolean not null default false, add column if not exists jun boolean not null default false,
  add column if not exists jul boolean not null default false, add column if not exists agu boolean not null default false,
  add column if not exists sep boolean not null default false, add column if not exists okt boolean not null default false,
  add column if not exists nov boolean not null default false, add column if not exists des boolean not null default false;

-- Kolom bulan yang sudah ada dari versi lama: beri nilai bawaan "belum bayar"
do $$ declare b text; begin
  foreach b in array array['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'] loop
    execute format('alter table public.iuran_bulanan alter column %I set default false', b);
  end loop;
end $$;

-- Tingkatan yang dikenal: Siaga Mula/Bantu/Tata dan Penggalang Ramu.
-- Aturan lama (tanpa 'ramu') diganti dengan yang baru.
alter table public.profil_pengguna drop constraint if exists profil_tingkat_valid;
alter table public.profil_pengguna drop constraint if exists profil_tingkat_dilantik_valid;
alter table public.profil_pengguna add constraint profil_tingkat_valid
  check (tingkat in ('mula','bantu','tata','ramu'));
alter table public.profil_pengguna add constraint profil_tingkat_dilantik_valid
  check (tingkat_dilantik is null or tingkat_dilantik in ('mula','bantu','tata','ramu'));

-- Kunci unik yang dipakai aplikasi saat menyimpan (upsert).
-- Bila gagal karena data ganda, hapus dulu baris gandanya (lihat panduan).
create unique index if not exists absensi_unik   on public.absensi_mingguan (siswa_id, tanggal);
create unique index if not exists iuran_unik     on public.iuran_bulanan   (siswa_id, tahun);
create unique index if not exists pencapaian_unik on public.pencapaian_sku  (siswa_id, kode_sku);

-- ---------------------------------------------------------------------
-- 3. Tabel fitur baru
-- ---------------------------------------------------------------------
create table if not exists public.kas_keluar (
  id          uuid primary key default gen_random_uuid(),
  gudep       text not null check (gudep in ('05.093','05.122')),
  tanggal     date not null default current_date,
  keterangan  text not null,
  jumlah      integer not null check (jumlah > 0),
  dibuat_oleh uuid default auth.uid(),
  dibuat_pada timestamptz not null default now()
);

create table if not exists public.agenda (
  id          uuid primary key default gen_random_uuid(),
  gudep       text check (gudep is null or gudep in ('05.093','05.122')),   -- kosong = semua Gudep
  tanggal     date not null,
  judul       text not null,
  keterangan  text,
  dibuat_oleh uuid default auth.uid(),
  dibuat_pada timestamptz not null default now()
);

create table if not exists public.materi_sku (
  kode    text primary key,
  tingkat text not null check (tingkat in ('mula','bantu','tata','ramu')),
  uraian  text not null,
  urutan  integer not null default 0,
  aktif   boolean not null default true
);

create table if not exists public.pengajuan_pelantikan (
  id              uuid primary key default gen_random_uuid(),
  siswa_id        uuid not null references public.profil_pengguna(id) on delete cascade,
  gudep           text not null,
  tingkat         text not null check (tingkat in ('mula','bantu','tata','ramu')),
  status          text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  catatan_pembina text,
  catatan_mabigus text,
  diajukan_oleh   uuid default auth.uid(),
  diajukan_pada   timestamptz not null default now(),
  diputus_oleh    uuid,
  diputus_pada    timestamptz
);
-- Tabel yang dibuat versi sebelumnya masih menolak 'ramu': ganti aturannya
alter table public.materi_sku drop constraint if exists materi_sku_tingkat_check;
alter table public.materi_sku add  constraint materi_sku_tingkat_check check (tingkat in ('mula','bantu','tata','ramu'));
alter table public.pengajuan_pelantikan drop constraint if exists pengajuan_pelantikan_tingkat_check;
alter table public.pengajuan_pelantikan add  constraint pengajuan_pelantikan_tingkat_check check (tingkat in ('mula','bantu','tata','ramu'));

create unique index if not exists pengajuan_satu_menunggu
  on public.pengajuan_pelantikan (siswa_id, tingkat) where status = 'menunggu';

-- ---------------------------------------------------------------------
-- 4. Fungsi bantu untuk aturan akses
--    (security definer agar tidak berputar saat membaca profil_pengguna)
--    Semua diberi awalan "pramuka_" agar tidak bertabrakan dengan fungsi lama di database.
-- ---------------------------------------------------------------------
create or replace function public.pramuka_peran() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.profil_pengguna where id = auth.uid() and aktif $$;

create or replace function public.pramuka_gudep() returns text
  language sql stable security definer set search_path = public
  as $$ select gudep from public.profil_pengguna where id = auth.uid() and aktif $$;

-- Gudep seorang siswa (null bila id itu bukan siswa)
create or replace function public.pramuka_gudep_siswa(p_siswa uuid) returns text
  language sql stable security definer set search_path = public
  as $$ select gudep from public.profil_pengguna where id = p_siswa and role = 'siswa' $$;

-- Boleh mengelola data siswa ini? (pembina aktif di Gudep yang sama)
create or replace function public.pramuka_pembina_dari(p_siswa uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.pramuka_peran() = 'pembina' and public.pramuka_gudep_siswa(p_siswa) = public.pramuka_gudep() $$;

-- Boleh melihat data siswa ini? (siswa itu sendiri, pembinanya, atau mabigus)
create or replace function public.pramuka_boleh_lihat(p_siswa uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select p_siswa = auth.uid() or public.pramuka_peran() = 'mabigus' or public.pramuka_pembina_dari(p_siswa) $$;

-- Lindungi kolom penting: NIS/NIP dan peran tidak boleh diubah dari aplikasi,
-- dan tingkatan yang sudah dilantik hanya berubah lewat persetujuan mabigus.
create or replace function public.pramuka_jaga_profil() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- dari server (service_role / SQL Editor)
  if new.id <> old.id or new.nis_nip <> old.nis_nip or new.role <> old.role then
    raise exception 'NIS/NIP dan peran tidak boleh diubah dari aplikasi';
  end if;
  if new.tingkat_dilantik is distinct from old.tingkat_dilantik and public.pramuka_peran() is distinct from 'mabigus' then
    raise exception 'Tingkatan yang sudah dilantik hanya bisa diubah lewat persetujuan mabigus';
  end if;
  return new;
end $$;
drop trigger if exists jaga_profil on public.profil_pengguna;   -- nama lama dari versi sebelumnya
drop trigger if exists pramuka_jaga_profil on public.profil_pengguna;
create trigger pramuka_jaga_profil before update on public.profil_pengguna
  for each row execute function public.pramuka_jaga_profil();

-- ---------------------------------------------------------------------
-- 5. Aturan akses (Row Level Security)
--    Semua aturan LAMA pada 8 tabel ini dihapus dulu, karena aturan di Supabase digabung
--    dengan "atau": satu aturan lama yang longgar (mis. "boleh baca semua") akan membuka
--    data yang seharusnya tertutup. Aturan di bawah ini sudah mencakup semua kebutuhan aplikasi.
-- ---------------------------------------------------------------------
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('profil_pengguna','absensi_mingguan','iuran_bulanan','pencapaian_sku',
             'kas_keluar','agenda','materi_sku','pengajuan_pelantikan')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profil_pengguna      enable row level security;
alter table public.absensi_mingguan     enable row level security;
alter table public.iuran_bulanan        enable row level security;
alter table public.pencapaian_sku       enable row level security;
alter table public.kas_keluar           enable row level security;
alter table public.agenda               enable row level security;
alter table public.materi_sku           enable row level security;
alter table public.pengajuan_pelantikan enable row level security;

-- profil_pengguna: lihat diri sendiri; pembina melihat Gudep-nya; mabigus melihat semua
drop policy if exists "profil baca"                 on public.profil_pengguna;
drop policy if exists "pembina ubah siswa gudepnya" on public.profil_pengguna;
drop policy if exists "mabigus ubah pembina"        on public.profil_pengguna;
create policy "profil baca" on public.profil_pengguna for select to authenticated
  using (id = auth.uid() or public.pramuka_peran() = 'mabigus'
         or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep()));
create policy "pembina ubah siswa gudepnya" on public.profil_pengguna for update to authenticated
  using      (public.pramuka_peran() = 'pembina' and role = 'siswa' and gudep = public.pramuka_gudep())
  with check (public.pramuka_peran() = 'pembina' and role = 'siswa' and gudep = public.pramuka_gudep());
create policy "mabigus ubah pembina" on public.profil_pengguna for update to authenticated
  using      (public.pramuka_peran() = 'mabigus' and role = 'pembina')
  with check (public.pramuka_peran() = 'mabigus' and role = 'pembina');
-- (Akun baru dibuat oleh Edge Function "buat-akun" dengan service_role, jadi tidak perlu aturan insert.)

-- absensi, iuran, pencapaian SKU: dibaca siswa ybs/pembinanya/mabigus, diubah pembinanya
drop policy if exists "absensi baca"  on public.absensi_mingguan;
drop policy if exists "absensi tulis" on public.absensi_mingguan;
create policy "absensi baca"  on public.absensi_mingguan for select to authenticated using (public.pramuka_boleh_lihat(siswa_id));
create policy "absensi tulis" on public.absensi_mingguan for all    to authenticated
  using (public.pramuka_pembina_dari(siswa_id)) with check (public.pramuka_pembina_dari(siswa_id));

drop policy if exists "iuran baca"  on public.iuran_bulanan;
drop policy if exists "iuran tulis" on public.iuran_bulanan;
create policy "iuran baca"  on public.iuran_bulanan for select to authenticated using (public.pramuka_boleh_lihat(siswa_id));
create policy "iuran tulis" on public.iuran_bulanan for all    to authenticated
  using (public.pramuka_pembina_dari(siswa_id)) with check (public.pramuka_pembina_dari(siswa_id));

drop policy if exists "sku baca"  on public.pencapaian_sku;
drop policy if exists "sku tulis" on public.pencapaian_sku;
create policy "sku baca"  on public.pencapaian_sku for select to authenticated using (public.pramuka_boleh_lihat(siswa_id));
create policy "sku tulis" on public.pencapaian_sku for all    to authenticated
  using (public.pramuka_pembina_dari(siswa_id)) with check (public.pramuka_pembina_dari(siswa_id));

-- kas keluar: pembina mengelola Gudep-nya, mabigus membaca semua
drop policy if exists "kas_keluar baca"  on public.kas_keluar;
drop policy if exists "kas_keluar tulis" on public.kas_keluar;
drop policy if exists "kas_keluar hapus" on public.kas_keluar;
create policy "kas_keluar baca" on public.kas_keluar for select to authenticated
  using (public.pramuka_peran() = 'mabigus' or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep()));
create policy "kas_keluar tulis" on public.kas_keluar for insert to authenticated
  with check (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep());
create policy "kas_keluar hapus" on public.kas_keluar for delete to authenticated
  using (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep());

-- agenda: semua yang masuk boleh membaca agenda Gudep-nya dan agenda umum
drop policy if exists "agenda baca"  on public.agenda;
drop policy if exists "agenda tulis" on public.agenda;
drop policy if exists "agenda hapus" on public.agenda;
create policy "agenda baca" on public.agenda for select to authenticated
  using (public.pramuka_peran() is not null and (gudep is null or public.pramuka_peran() = 'mabigus' or gudep = public.pramuka_gudep()));
create policy "agenda tulis" on public.agenda for insert to authenticated
  with check (public.pramuka_peran() = 'mabigus' or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep()));
create policy "agenda hapus" on public.agenda for delete to authenticated
  using (public.pramuka_peran() = 'mabigus' or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep()));

-- butir SKU: semua boleh membaca; pembina dan mabigus boleh menambah dan mengubah (tidak ada hapus)
drop policy if exists "materi_sku baca"  on public.materi_sku;
drop policy if exists "materi_sku tulis" on public.materi_sku;
drop policy if exists "materi_sku ubah"  on public.materi_sku;
create policy "materi_sku baca"  on public.materi_sku for select to authenticated using (true);
create policy "materi_sku tulis" on public.materi_sku for insert to authenticated
  with check (public.pramuka_peran() in ('pembina','mabigus'));
create policy "materi_sku ubah"  on public.materi_sku for update to authenticated
  using (public.pramuka_peran() in ('pembina','mabigus')) with check (public.pramuka_peran() in ('pembina','mabigus'));

-- pengajuan pelantikan: pembina mengajukan; keputusan hanya lewat fungsi putuskan_pelantikan
drop policy if exists "pelantikan baca"   on public.pengajuan_pelantikan;
drop policy if exists "pelantikan ajukan" on public.pengajuan_pelantikan;
create policy "pelantikan baca" on public.pengajuan_pelantikan for select to authenticated
  using (public.pramuka_boleh_lihat(siswa_id));
create policy "pelantikan ajukan" on public.pengajuan_pelantikan for insert to authenticated
  with check (public.pramuka_pembina_dari(siswa_id) and gudep = public.pramuka_gudep() and status = 'menunggu'
              and diputus_oleh is null and catatan_mabigus is null);

-- ---------------------------------------------------------------------
-- 6. Keputusan pelantikan oleh mabigus (status + tingkatan siswa berubah sekaligus)
-- ---------------------------------------------------------------------
drop function if exists public.putuskan_pelantikan(uuid, boolean, text);
create or replace function public.putuskan_pelantikan(p_id uuid, p_setuju boolean, p_catatan text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.pengajuan_pelantikan;
begin
  if public.pramuka_peran() is distinct from 'mabigus' then
    raise exception 'Hanya mabigus yang boleh memutuskan pelantikan';
  end if;
  select * into r from public.pengajuan_pelantikan where id = p_id for update;
  if not found or r.status <> 'menunggu' then
    raise exception 'Pengajuan tidak ditemukan atau sudah diputuskan';
  end if;
  update public.pengajuan_pelantikan
     set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         catatan_mabigus = p_catatan, diputus_oleh = auth.uid(), diputus_pada = now()
   where id = p_id;
  if p_setuju then
    update public.profil_pengguna
       set tingkat_dilantik = r.tingkat,
           -- Siaga naik Mula > Bantu > Tata. Pindah ke Penggalang Ramu diatur pembina di menu Anggota.
           tingkat = case r.tingkat when 'mula' then 'bantu' when 'bantu' then 'tata' else r.tingkat end
     where id = r.siswa_id;
  end if;
end $$;
revoke all on function public.putuskan_pelantikan(uuid, boolean, text) from public, anon;
grant execute on function public.putuskan_pelantikan(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Isi awal butir SKU (CONTOH — sesuaikan lewat menu SKU > Kelola butir SKU)
--    Butir yang sudah ada tidak ditimpa.
-- ---------------------------------------------------------------------
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
 ('T-09','tata','Lari 50 meter atau ketangkasan sejenis',9),('T-10','tata','Bercerita tentang pahlawan nasional',10),
 ('R-01','ramu','Taat menjalankan ibadah sesuai agamanya',1),('R-02','ramu','Hafal dan memahami Trisatya dan Dasadarma',2),
 ('R-03','ramu','Mengetahui sejarah Gerakan Pramuka dan Bapak Pandu Sedunia',3),('R-04','ramu','Menjelaskan arti lambang Gerakan Pramuka',4),
 ('R-05','ramu','Hafal lagu Indonesia Raya dan dua lagu wajib nasional',5),('R-06','ramu','Mengetahui susunan dan tata cara upacara bendera',6),
 ('R-07','ramu','Melakukan baris-berbaris dan tata upacara',7),('R-08','ramu','Membuat enam macam simpul dan ikatan',8),
 ('R-09','ramu','Mengenal sandi morse atau semaphore',9),('R-10','ramu','Mengenal tanda jejak dan menggunakannya',10),
 ('R-11','ramu','Menaksir tinggi pohon dan lebar sungai',11),('R-12','ramu','Memberi pertolongan pertama pada luka ringan',12),
 ('R-13','ramu','Membaca kompas dan mengenal delapan arah mata angin',13),('R-14','ramu','Menabung secara teratur',14),
 ('R-15','ramu','Berkemah satu malam bersama regu',15)
on conflict (kode) do nothing;

-- Catatan: kode SKU lama (SKU-01 s.d. SKU-05) dari versi awal aplikasi tidak dihapus,
-- tetapi tidak tampil lagi. Siswa perlu dicentang ulang dengan butir baru.

-- ---------------------------------------------------------------------
-- 8. Pemeriksaan: hasil query ini harus menampilkan 8 tabel dengan rls = true dan jumlah_aturan 2–3
-- ---------------------------------------------------------------------
select c.relname as tabel, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as jumlah_aturan
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profil_pengguna','absensi_mingguan','iuran_bulanan','pencapaian_sku',
  'kas_keluar','agenda','materi_sku','pengajuan_pelantikan')
order by 1;
