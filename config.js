/* ============ KONFIGURASI SUPABASE — UBAH DI SINI ============ */
const SUPABASE_URL = 'https://rdilqnpfbszwvktzmxts.supabase.co';   // Project URL (Settings > API)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaWxxbnBmYnN6d3ZrdHpteHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY1MTksImV4cCI6MjEwNjQ0MjUxOX0.bms1zT5TLBfJY3jSro2msGegaQ3ZsPAElB86M7X79nI';        // anon public key (JANGAN pakai service_role!)
const DOMAIN_EMAIL = '@sdn3boloh.sch.id';               // ditambahkan otomatis ke NIS/NIP
const IURAN_PER_BULAN = 5000;                           // nominal iuran (Rp) untuk hitung kas
/* ============================================================== */
/* Asumsi skema (sesuaikan bila nama kolom Anda berbeda):
   profil_pengguna: id(uuid=auth.uid), nis_nip, nama, role('mabigus'|'pembina'|'siswa'), gudep('05.093'|'05.122')
   absensi_mingguan: siswa_id, tanggal, status('H'|'S'|'I'|'A')  unique(siswa_id,tanggal)
   iuran_bulanan: siswa_id, tahun, jan,feb,mar,apr,mei,jun,jul,agu,sep,okt,nov,des (boolean) unique(siswa_id,tahun)
   pencapaian_sku: siswa_id, kode_sku, tanggal, nip_penguji  unique(siswa_id,kode_sku) */

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BULAN = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
const hariIni = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (lokal)

function toast(t){let e=document.getElementById('toast');if(!e){e=document.createElement('div');e.id='toast';document.body.append(e)}
  e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}

/* Wajib login + cek role. Kembalikan profil, atau redirect ke index.html */
async function butuhLogin(roleBoleh){
  const {data:{session}} = await db.auth.getSession();
  if(!session){location.href='index.html';return null}
  const {data:p,error} = await db.from('profil_pengguna').select('*').eq('id',session.user.id).single();
  if(error||!p||(roleBoleh&&!roleBoleh.includes(p.role))){location.href='dashboard.html';return null}
  renderNav(p);return p;
}
function renderNav(p){
  const hal=location.pathname.split('/').pop();
  const m=[['dashboard.html','Beranda']];
  if(p.role==='pembina') m.push(['absensi.html','Absen'],['iuran.html','Iuran'],['uji_sku.html','Uji SKU']);
  const n=document.getElementById('nav');
  n.className='nav';
  n.innerHTML=`<b>Pramuka SDN 3 Boloh</b><div class="links">${m.map(([h,t])=>`<a href="${h}" class="${h===hal?'aktif':''}">${t}</a>`).join('')}<button id="keluar">Keluar</button></div>`;
  document.getElementById('keluar').onclick=async()=>{await db.auth.signOut();location.href='index.html'};
}
/* Daftar siswa yang boleh dikelola: Pembina -> hanya Gudep-nya */
async function ambilSiswa(p){
  let q=db.from('profil_pengguna').select('id,nama,nis_nip,gudep').eq('role','siswa').order('nama');
  if(p.role==='pembina') q=q.eq('gudep',p.gudep);
  const {data,error}=await q; if(error){toast('Gagal memuat siswa');return []} return data;
}
