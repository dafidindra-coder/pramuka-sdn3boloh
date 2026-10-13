/* Daftar SKU Siaga per tingkatan.
   CONTOH — samakan dengan buku SKU Siaga resmi yang dipakai Gudep. Kode harus unik dan jangan diubah
   setelah dipakai, karena pencapaian siswa disimpan berdasarkan kode. */
const MATERI_SKU = {
  mula: [
    ['M-01','Taat menjalankan ibadah agamanya'],
    ['M-02','Hafal Dwi Satya dan Dwi Darma'],
    ['M-03','Mengenal bendera Merah Putih dan cara menghormatinya'],
    ['M-04','Hafal lagu Indonesia Raya'],
    ['M-05','Menyebutkan nama presiden dan wakil presiden'],
    ['M-06','Mengenal dan melakukan salam Pramuka'],
    ['M-07','Hafal alamat rumah dan nama orang tua'],
    ['M-08','Membuat simpul mati dan simpul hidup'],
    ['M-09','Menjaga kebersihan diri (gosok gigi, cuci tangan)'],
    ['M-10','Melakukan baris-berbaris dasar (siap, istirahat)']
  ],
  bantu: [
    ['B-01','Hafal doa sebelum dan sesudah kegiatan'],
    ['B-02','Memahami isi Dwi Darma'],
    ['B-03','Hafal lagu Padamu Negeri dan Hari Merdeka'],
    ['B-04','Menyebutkan sila-sila Pancasila'],
    ['B-05','Membuat simpul pangkal dan simpul anyam'],
    ['B-06','Mengenal tanda barung dan tanda tingkatan Siaga'],
    ['B-07','Berhitung uang sampai Rp 100.000'],
    ['B-08','Membantu pekerjaan di rumah'],
    ['B-09','Mengenal P3K sederhana (plester, obat luka)'],
    ['B-10','Menyanyikan dua lagu daerah']
  ],
  tata: [
    ['T-01','Menjelaskan arti lambang Tunas Kelapa'],
    ['T-02','Menjelaskan arti lambang Garuda Pancasila'],
    ['T-03','Mengenal sandi morse huruf A–J'],
    ['T-04','Membuat tandu sederhana dari tongkat dan tali'],
    ['T-05','Mengenal delapan arah mata angin'],
    ['T-06','Memimpin barung dalam permainan'],
    ['T-07','Menabung secara teratur'],
    ['T-08','Menolong teman yang kesulitan'],
    ['T-09','Lari 50 meter atau ketangkasan sejenis'],
    ['T-10','Bercerita tentang pahlawan nasional']
  ]
};
const URUT_TINGKAT = ['mula','bantu','tata'];
/* Progres per tingkat dari himpunan kode yang sudah lulus */
const progresSku = lulus => Object.fromEntries(URUT_TINGKAT.map(t=>{
  const n=MATERI_SKU[t].filter(([k])=>lulus.has(k)).length; return [t,{lulus:n,total:MATERI_SKU[t].length}];
}));
