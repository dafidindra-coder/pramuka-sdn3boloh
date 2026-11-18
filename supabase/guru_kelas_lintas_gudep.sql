-- =====================================================================
-- GURU KELAS LINTAS GUDEP (tanpa menghapus apa pun; aman diulang)
-- Guru kelas mencatat iuran semua siswa di kelasnya (putra dan putri).
-- Setoran masuk ke kas Gudep siswa dan dikonfirmasi pembina Gudep itu atau mabigus.
-- Isinya sama dengan bagian terkait di perubahan_skema.sql.
-- =====================================================================
create or replace function public.pramuka_wali_kelas_dari(p_siswa uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce(public.pramuka_peran() = 'pembina' and public.pramuka_kelas_saya() is not null
          and public.pramuka_kelas_saya() = (select public.pramuka_norm_kelas(kelas) from public.profil_pengguna
                                             where id = p_siswa and role = 'siswa'), false) $$;

alter policy "profil baca" on public.profil_pengguna
  using (id = auth.uid() or public.pramuka_peran() = 'mabigus'
         or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep())
         or (role = 'siswa' and public.pramuka_kelas_saya() is not null and public.pramuka_norm_kelas(kelas) = public.pramuka_kelas_saya()));

alter policy "iuran baca" on public.iuran_bulanan
  using (public.pramuka_boleh_lihat(siswa_id) or public.pramuka_wali_kelas_dari(siswa_id));

alter policy "setoran baca" on public.setoran_iuran
  using (public.pramuka_peran() = 'mabigus' or (public.pramuka_peran() = 'pembina' and gudep = public.pramuka_gudep())
         or disetor_oleh = auth.uid());

alter policy "setoran catat" on public.setoran_iuran
  with check (public.pramuka_peran() = 'pembina'
              and public.pramuka_kelas_saya() is not null and kelas = public.pramuka_kelas_saya()
              and disetor_oleh = auth.uid() and status = 'menunggu' and diterima_oleh is null);

notify pgrst, 'reload schema';
