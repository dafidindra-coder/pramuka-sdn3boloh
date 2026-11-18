-- =====================================================================
-- IURAN PER GURU KELAS + SETORAN (versi ringkas, tanpa menghapus apa pun; aman diulang)
-- Untuk database yang sudah menjalankan perubahan_skema.sql versi sebelumnya.
-- (Bila iuran_per_kelas.sql versi lama sudah pernah dijalankan, jalankan guru_kelas_lintas_gudep.sql.)
-- Isinya sama dengan bagian iuran per kelas di perubahan_skema.sql.
-- =====================================================================

-- 1. Tabel setoran uang iuran dari guru kelas ke kas Gudep
create table if not exists public.setoran_iuran (
  id            uuid primary key default gen_random_uuid(),
  gudep         text not null check (gudep in ('05.093','05.122')),
  kelas         text not null,
  tanggal       date not null default current_date,
  jumlah        integer not null check (jumlah > 0),
  keterangan    text,
  status        text not null default 'menunggu' check (status in ('menunggu','diterima')),
  disetor_oleh  uuid not null default auth.uid(),
  dibuat_pada   timestamptz not null default now(),
  diterima_oleh uuid,
  diterima_pada timestamptz
);
alter table public.setoran_iuran enable row level security;

-- 2. Fungsi bantu guru kelas
create or replace function public.pramuka_norm_kelas(p text) returns text
  language sql immutable
  as $$ select nullif(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')), '') $$;

create or replace function public.pramuka_kelas_saya() returns text
  language sql stable security definer set search_path = public
  as $$ select public.pramuka_norm_kelas(kelas) from public.profil_pengguna
        where id = auth.uid() and aktif and role = 'pembina' $$;

-- Guru kelas memegang siswa kelasnya di kedua Gudep (putra dan putri)
create or replace function public.pramuka_wali_kelas_dari(p_siswa uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce(public.pramuka_peran() = 'pembina' and public.pramuka_kelas_saya() is not null
          and public.pramuka_kelas_saya() = (select public.pramuka_norm_kelas(kelas) from public.profil_pengguna
                                             where id = p_siswa and role = 'siswa'), false) $$;

-- 3. Iuran hanya dicatat guru kelas untuk siswa di kelasnya (aturan lama diubah, bukan dihapus)
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'iuran_bulanan' and policyname = 'iuran tulis') then
    alter policy "iuran tulis" on public.iuran_bulanan
      using (public.pramuka_wali_kelas_dari(siswa_id)) with check (public.pramuka_wali_kelas_dari(siswa_id));
  else
    create policy "iuran tulis" on public.iuran_bulanan for all to authenticated
      using (public.pramuka_wali_kelas_dari(siswa_id)) with check (public.pramuka_wali_kelas_dari(siswa_id));
  end if;
end $$;

-- 4. Aturan akses setoran (dibuat bila belum ada)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'setoran_iuran' and policyname = 'setoran baca') then
    create policy "setoran baca" on public.setoran_iuran for select to authenticated
      using (public.pramuka_peran() = 'mabigus' or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep())
             or disetor_oleh = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'setoran_iuran' and policyname = 'setoran catat') then
    create policy "setoran catat" on public.setoran_iuran for insert to authenticated
      with check (public.pramuka_peran() = 'pembina'
                  and public.pramuka_kelas_saya() is not null and kelas = public.pramuka_kelas_saya()
                  and disetor_oleh = auth.uid() and status = 'menunggu' and diterima_oleh is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'setoran_iuran' and policyname = 'setoran batal') then
    create policy "setoran batal" on public.setoran_iuran for delete to authenticated
      using (disetor_oleh = auth.uid() and status = 'menunggu');
  end if;
end $$;

-- 5. Konfirmasi setoran: oleh pembina lain di Gudep yang sama, atau mabigus
create or replace function public.terima_setoran(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.setoran_iuran;
begin
  select * into r from public.setoran_iuran where id = p_id for update;
  if not found or r.status <> 'menunggu' then
    raise exception 'Setoran tidak ditemukan atau sudah diterima';
  end if;
  if not (public.pramuka_peran() = 'mabigus'
          or (public.pramuka_peran() = 'pembina' and public.pramuka_gudep() = r.gudep)) then
    raise exception 'Anda tidak berhak menerima setoran ini';
  end if;
  if r.disetor_oleh = auth.uid() then
    raise exception 'Setoran harus dikonfirmasi oleh pembina lain atau mabigus, bukan oleh penyetor';
  end if;
  update public.setoran_iuran set status = 'diterima', diterima_oleh = auth.uid(), diterima_pada = now() where id = p_id;
end $$;
revoke all on function public.terima_setoran(uuid) from public, anon;
grant execute on function public.terima_setoran(uuid) to authenticated;

-- 6. Muat ulang daftar tabel & fungsi di Supabase
notify pgrst, 'reload schema';
