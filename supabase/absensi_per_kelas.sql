-- Absensi per kelas: guru kelas boleh mengisi dan melihat absensi semua siswa di kelasnya
-- (putra dan putri, kedua Gudep). Pembina Gudep tetap boleh mengabsen siswa Gudep-nya.
-- Aman dijalankan berulang. Butuh fungsi dari iuran_per_kelas.sql / perubahan_skema.sql.
alter policy "absensi baca" on public.absensi_mingguan
  using (public.pramuka_boleh_lihat(siswa_id) or public.pramuka_wali_kelas_dari(siswa_id));
alter policy "absensi tulis" on public.absensi_mingguan
  using      (public.pramuka_pembina_dari(siswa_id) or public.pramuka_wali_kelas_dari(siswa_id))
  with check (public.pramuka_pembina_dari(siswa_id) or public.pramuka_wali_kelas_dari(siswa_id));
notify pgrst, 'reload schema';
