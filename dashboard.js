(async()=>{
  const p=await butuhLogin(); if(!p) return;
  const label={mabigus:'Mabigus',pembina:'Pembina',siswa:'Siswa'}[p.role];
  const gudep=p.gudep?`Gudep ${p.gudep} ${p.gudep==='05.093'?'Putra':'Putri'}`:'Semua Gudep';
  document.getElementById('nama').textContent=p.nama;
  document.getElementById('info').textContent=`${label} · ${gudep}`;

  // Daftar siswa cakupan (RLS tetap penjaga utama); siswa hanya dirinya sendiri
  const ids = p.role==='siswa' ? [p.id] : (await ambilSiswa(p)).map(s=>s.id);
  const tahun=new Date().getFullYear();
  const [abs,iur,sku]=await Promise.all([
    db.from('absensi_mingguan').select('status').in('siswa_id',ids),
    db.from('iuran_bulanan').select('*').in('siswa_id',ids).eq('tahun',tahun),
    db.from('pencapaian_sku').select('kode_sku').in('siswa_id',ids)
  ]);
  const total=abs.data?.length||0, hadir=abs.data?.filter(a=>a.status==='H').length||0;
  const persen=total?Math.round(hadir/total*100):0;
  const lunas=(iur.data||[]).reduce((n,r)=>n+BULAN.filter(b=>r[b]).length,0);
  const kas=lunas*IURAN_PER_BULAN;
  const kartu=(j,v,s)=>`<div class="card"><div class="muted">${j}</div><div class="stat">${v}</div><div class="muted">${s}</div></div>`;
  let h='';
  if(p.role!=='siswa') h+=kartu('Jumlah siswa',ids.length,gudep);
  h+=kartu('Kehadiran',persen+'%',`${hadir} dari ${total} pertemuan`);
  if(p.role==='siswa'){
    const r=iur.data?.[0]||{};
    h+=kartu('Iuran '+tahun,BULAN.filter(b=>r[b]).length+'/12','bulan lunas');
  } else h+=kartu('Kas terkumpul','Rp '+kas.toLocaleString('id-ID'),`${lunas} pembayaran bulanan`);
  h+=kartu('SKU tercapai',sku.data?.length||0,'butir materi');
  document.getElementById('ringkasan').innerHTML=h;

  // Tombol aksi hanya untuk Pembina
  if(p.role==='pembina') document.getElementById('aksi').innerHTML=
    `<a class="btn" href="absensi.html">Absen hari ini</a><a class="btn" href="iuran.html">Catat iuran</a><a class="btn" href="uji_sku.html">Uji SKU</a>`;
})();
