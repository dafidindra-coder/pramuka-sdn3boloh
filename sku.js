/* Daftar SKU Siaga per tingkatan.
   Sumber utama: tabel materi_sku (bisa diubah di menu SKU > Kelola butir).
   Daftar di bawah hanya cadangan bila tabel belum dibuat — CONTOH, samakan dengan buku SKU resmi. */
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
const TINGKAT_BERIKUT = {mula:'bantu',bantu:'tata',tata:null};

/* Muat butir SKU aktif dari database ke MATERI_SKU. Kembalikan semua baris (termasuk nonaktif) untuk halaman kelola. */
async function muatMateriSku(){
  const {data,error}=await db.from('materi_sku').select('*').order('urutan');
  if(error||!data?.length) return {dariDb:false,error,semua:[]};
  URUT_TINGKAT.forEach(t=>{MATERI_SKU[t]=data.filter(r=>r.tingkat===t&&r.aktif!==false).map(r=>[r.kode,r.uraian])});
  return {dariDb:true,semua:data};
}
/* Progres per tingkat dari himpunan kode yang sudah lulus */
const progresSku = lulus => Object.fromEntries(URUT_TINGKAT.map(t=>{
  const n=MATERI_SKU[t].filter(([k])=>lulus.has(k)).length; return [t,{lulus:n,total:MATERI_SKU[t].length}];
}));
const skuPenuh = pr => pr.total>0 && pr.lulus===pr.total;
const lebarPersen = pr => pr.total ? pr.lulus/pr.total*100 : 0;
/* Siap dilantik = semua butir tingkatan yang sedang ditempuh sudah lulus, dan tingkatan itu belum dilantik */
function statusSiswaSku(s, lulus){
  const tk=s.tingkat||'mula', pr=progresSku(lulus);
  return {tk, pr, siap: skuPenuh(pr[tk]) && s.tingkat_dilantik!==tk};
}
