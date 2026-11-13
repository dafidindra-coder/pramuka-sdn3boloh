-- =====================================================================
-- AKTIFKAN FOTO PROFIL (bisa dijalankan sendiri, aman diulang)
-- Supabase > SQL Editor > New query > tempel SELURUH isi file ini > Run
-- Pastikan tidak ada teks yang sedang diblok/di-select, agar seluruh skrip yang dijalankan.
-- =====================================================================

-- 1. Kolom foto (gambar kecil, data:image/jpeg;base64,...)
alter table public.profil_pengguna add column if not exists foto text;

alter table public.profil_pengguna drop constraint if exists profil_foto_valid;
alter table public.profil_pengguna add constraint profil_foto_valid
  check (foto is null or (foto like 'data:image/%' and length(foto) <= 300000));

-- 2. Fungsi agar setiap pengguna bisa mengganti fotonya sendiri (dan tidak mengubah kolom lain)
drop function if exists public.ubah_foto_saya(text);
create function public.ubah_foto_saya(p_foto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
       select 1 from public.profil_pengguna where id = auth.uid() and coalesce(aktif, true)) then
    raise exception 'Silakan masuk terlebih dahulu';
  end if;
  update public.profil_pengguna set foto = nullif(p_foto, '') where id = auth.uid();
end $$;
revoke all on function public.ubah_foto_saya(text) from public, anon;
grant execute on function public.ubah_foto_saya(text) to authenticated;

-- 3. Minta Supabase memuat ulang daftar tabel & fungsi (schema cache) agar langsung terlihat oleh aplikasi
notify pgrst, 'reload schema';

-- 4. Pemeriksaan: kedua baris harus bernilai true
select 'kolom foto' as cek,
       exists(select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profil_pengguna' and column_name = 'foto') as ok
union all
select 'fungsi ubah_foto_saya (boleh dipakai pengguna yang login)',
       exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'ubah_foto_saya')
       and has_function_privilege('authenticated', 'public.ubah_foto_saya(text)', 'execute');
