/* ============ KONFIGURASI SUPABASE — UBAH DI SINI ============ */
const SUPABASE_URL = 'https://rdilqnpfbszwvktzmxts.supabase.co';   // Project URL (Settings > API)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaWxxbnBmYnN6d3ZrdHpteHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY1MTksImV4cCI6MjEwNjQ0MjUxOX0.bms1zT5TLBfJY3jSro2msGegaQ3ZsPAElB86M7X79nI';        // anon public key (JANGAN pakai service_role!)
const DOMAIN_EMAIL = '@sdn3boloh.sch.id';               // ditambahkan otomatis ke NIS/NIP
const IURAN_PER_BULAN = 5000;                           // nominal iuran (Rp) untuk hitung kas
/* ============================================================== */
/* Skema (lihat supabase/perubahan_skema.sql untuk kolom & tabel baru):
   profil_pengguna: id(uuid=auth.uid), nis_nip, nama, role('mabigus'|'pembina'|'siswa'), gudep('05.093'|'05.122'),
                    kelas, tingkat('mula'|'bantu'|'tata'), barung, hp_ortu, aktif(boolean)
   absensi_mingguan: siswa_id, tanggal, status('H'|'S'|'I'|'A')  unique(siswa_id,tanggal)
   iuran_bulanan: siswa_id, tahun, jan,feb,mar,apr,mei,jun,jul,agu,sep,okt,nov,des (boolean) unique(siswa_id,tahun)
   pencapaian_sku: siswa_id, kode_sku, tanggal, nip_penguji  unique(siswa_id,kode_sku)
   kas_keluar: id, gudep, tanggal, keterangan, jumlah
   agenda: id, gudep (null = semua Gudep), tanggal, judul, keterangan */

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BULAN = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const GUDEP = {'05.093':'Putra','05.122':'Putri'};
const TINGKAT = {mula:'Siaga Mula',bantu:'Siaga Bantu',tata:'Siaga Tata'};
const hariIni = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (lokal)

/* Amankan teks sebelum dimasukkan ke innerHTML (mencegah XSS dari nama/keterangan) */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupiah = n => 'Rp ' + (n||0).toLocaleString('id-ID');
const tglPendek = t => new Date(t+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const tglPanjang = t => new Date(t+'T00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const namaGudep = g => g ? `Gudep ${g} ${GUDEP[g]||''}`.trim() : 'Semua Gudep';

function toast(t){let e=document.getElementById('toast');if(!e){e=document.createElement('div');e.id='toast';e.setAttribute('role','status');document.body.append(e)}
  e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

/* Pesan error di dalam halaman (bukan hanya toast) */
function tampilError(el, judul, err){
  const tabelHilang = err && /relation .* does not exist|could not find the table|column .* does not exist/i.test(err.message||'');
  el.innerHTML=`<div class="kosong galat"><b>${esc(judul)}</b><span>${tabelHilang
    ? 'Tabel atau kolom baru belum dibuat. Jalankan <code>supabase/perubahan_skema.sql</code> di SQL Editor Supabase.'
    : 'Periksa koneksi internet, lalu muat ulang halaman.'}</span></div>`;
}

/* Wajib login + cek role. Kembalikan profil, atau redirect */
async function butuhLogin(roleBoleh){
  const {data:{session}} = await db.auth.getSession();
  if(!session){location.href='index.html';return null}
  const {data:p,error} = await db.from('profil_pengguna').select('*').eq('id',session.user.id).single();
  // Akun tanpa profil: keluar (dulu ini mengarah ke dashboard.html lagi dan berputar tanpa henti)
  if(error||!p){await db.auth.signOut();location.href='index.html?e=profil';return null}
  if(roleBoleh&&!roleBoleh.includes(p.role)){location.href='dashboard.html';return null}
  renderNav(p);return p;
}

const IKON={
  beranda:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  absen:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M8 13l3 3 5-6"/>',
  iuran:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  sku:'<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  anggota:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
  rekap:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  keluar:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>'
};
const ikon=(n,c='')=>`<svg class="ikon ${c}" viewBox="0 0 24 24" aria-hidden="true">${IKON[n]}</svg>`;

function renderNav(p){
  const hal=location.pathname.split('/').pop()||'index.html';
  const menu={
    pembina:[['dashboard.html','Beranda','beranda'],['absensi.html','Absen','absen'],['iuran.html','Iuran','iuran'],['uji_sku.html','SKU','sku'],['anggota.html','Anggota','anggota']],
    mabigus:[['dashboard.html','Beranda','beranda'],['rekap.html','Rekap','rekap']],
    siswa:[]
  }[p.role]||[];
  const n=document.getElementById('nav');
  n.className='atas';
  n.innerHTML=`<img src="cikal.png" alt="" class="logo-kecil"><div class="judul-app"><b>Pramuka SDN 3 Boloh</b><span>${esc(p.nama)} · ${esc({mabigus:'Mabigus',pembina:'Pembina',siswa:'Siswa'}[p.role])}</span></div>
    <button id="keluar" class="tombol-ikon" aria-label="Keluar">${ikon('keluar')}</button>`;
  document.getElementById('keluar').onclick=async()=>{await db.auth.signOut();location.href='index.html'};
  if(menu.length>1){
    const b=document.createElement('nav');b.className='bawah';b.setAttribute('aria-label','Menu utama');
    b.innerHTML=menu.map(([h,t,i])=>`<a href="${h}" class="${h===hal?'aktif':''}" ${h===hal?'aria-current="page"':''}>${ikon(i)}<span>${t}</span></a>`).join('');
    document.body.append(b);document.body.classList.add('ada-menu');
  }
}

/* Daftar siswa yang boleh dikelola: Pembina -> hanya Gudep-nya. Siswa nonaktif disembunyikan kecuali diminta. */
async function ambilSiswa(p,{termasukNonaktif=false}={}){
  let q=db.from('profil_pengguna').select('*').eq('role','siswa').order('nama');
  if(p.role==='pembina') q=q.eq('gudep',p.gudep);
  const {data,error}=await q; if(error){toast('Gagal memuat siswa');return []}
  return termasukNonaktif?data:data.filter(s=>s.aktif!==false);
}

/* Pemasangan ke layar utama HP (PWA). Abaikan bila browser tidak mendukung. */
if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
