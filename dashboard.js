(async()=>{
  const p=await butuhLogin(); if(!p) return;
  const isi=document.getElementById('isi');
  const tahun=new Date().getFullYear(), bulanIni=new Date().getMonth();
  const kartu=(j,v,s,cls='')=>`<div class="card"><div class="label">${j}</div><div class="stat ${cls}">${v}</div><div class="muted">${s}</div></div>`;

  // Siswa hanya dirinya sendiri; pembina hanya Gudep-nya; mabigus semua (RLS tetap penjaga utama)
  const siswa = p.role==='siswa' ? [p] : await ambilSiswa(p);
  const ids = siswa.map(s=>s.id);
  const kosong = {data:[],error:null};
  const [abs,iur,sku,klr,agd,ajuan] = await Promise.all([
    ids.length?db.from('absensi_mingguan').select('siswa_id,tanggal,status').in('siswa_id',ids):kosong,
    ids.length?db.from('iuran_bulanan').select('*').in('siswa_id',ids):kosong,
    ids.length?db.from('pencapaian_sku').select('siswa_id,kode_sku,tanggal').in('siswa_id',ids):kosong,
    p.role==='siswa'?kosong:(p.role==='pembina'?db.from('kas_keluar').select('gudep,jumlah').eq('gudep',p.gudep):db.from('kas_keluar').select('gudep,jumlah')),
    db.from('agenda').select('*').gte('tanggal',hariIni()).order('tanggal'),
    db.from('pengajuan_pelantikan').select('*').eq('status','menunggu'),
    muatMateriSku()
  ]);
  const menunggu=ajuan.error?[]:ajuan.data;   // tabel belum dibuat -> anggap kosong
  if(abs.error||iur.error||sku.error){ tampilError(isi,'Data Beranda gagal dimuat',abs.error||iur.error||sku.error); return; }

  /* ---------- Perhitungan ---------- */
  function hitung(daftar){
    const idSet=new Set(daftar.map(s=>s.id));
    const a=abs.data.filter(r=>idSet.has(r.siswa_id));
    const hadir=a.filter(r=>r.status==='H').length;
    const tanggal=[...new Set(a.map(r=>r.tanggal))].sort();
    const seri=tanggal.slice(-8).map(t=>{const x=a.filter(r=>r.tanggal===t);return {t,pct:Math.round(x.filter(r=>r.status==='H').length/x.length*100)}});
    const iuranRows=iur.data.filter(r=>idSet.has(r.siswa_id));
    const lunas=iuranRows.reduce((n,r)=>n+BULAN.filter(b=>r[b]).length,0);
    const gudepSet=new Set(daftar.map(s=>s.gudep));
    const keluar=(klr.data||[]).filter(r=>gudepSet.has(r.gudep)).reduce((n,r)=>n+(r.jumlah||0),0);
    const s=sku.data.filter(r=>idSet.has(r.siswa_id));
    const lulusPer=id=>new Set(s.filter(r=>r.siswa_id===id).map(r=>r.kode_sku));
    const siapList=daftar.filter(x=>statusSiswaSku(x,lulusPer(x.id)).siap&&!menunggu.some(m=>m.siswa_id===x.id));
    const siap=siapList.length;
    // Perlu perhatian: alfa >= 2 dari 4 latihan terakhir, atau menunggak >= 3 bulan tahun ini
    const empatTerakhir=tanggal.slice(-4);
    const perhatian=[];
    daftar.forEach(x=>{
      const alfa=a.filter(r=>r.siswa_id===x.id&&r.status==='A'&&empatTerakhir.includes(r.tanggal)).length;
      // Tunggakan dihitung sejak latihan pertama tahun ini, agar siswa baru tidak langsung ditandai
      const r=iuranRows.find(r=>r.siswa_id===x.id&&r.tahun===tahun)||{};
      const pertama=a.filter(r=>r.siswa_id===x.id&&r.tanggal.startsWith(tahun+'-')).map(r=>r.tanggal).sort()[0];
      const mulai=pertama?Math.min(+pertama.slice(5,7)-1,BULAN.findIndex(b=>r[b])>=0?BULAN.findIndex(b=>r[b]):12):bulanIni+1;
      const nunggak=BULAN.slice(mulai,bulanIni+1).filter(b=>!r[b]).length;
      const alasan=[];
      if(alfa>=2) alasan.push(`<span class="pil merah">Alfa ${alfa}× dari 4 latihan</span>`);
      if(nunggak>=3) alasan.push(`<span class="pil kuning">Iuran kurang ${nunggak} bulan</span>`);
      if(alasan.length) perhatian.push({x,alasan});
    });
    return {total:a.length,hadir,pct:a.length?Math.round(hadir/a.length*100):0,seri,masuk:lunas*IURAN_PER_BULAN,keluar,
      lunas,skuN:s.length,siap,siapList,perhatian};
  }

  const grafik=seri=>seri.length?`<div class="grafik" role="img" aria-label="Persentase hadir ${seri.length} latihan terakhir">${seri.map((d,i)=>
    `<div class="kolom" title="${tglPanjang(d.t)}: ${d.pct}% hadir">${i===seri.length-1?`<em>${d.pct}%</em>`:''}<i style="height:${Math.max(d.pct,2)}%"></i><span>${tglPendek(d.t)}</span></div>`).join('')}</div>`
    :'<p class="muted" style="margin-top:8px">Belum ada absensi.</p>';

  const ubin=(href,ik,judul,info='')=>`<a class="ubin" href="${href}">${ikon(ik)}<span><b>${judul}</b>${info?`<small>${info}</small>`:''}</span></a>`;
  const daftarPerhatian=list=>list.length
    ?`<ul class="daftar">${list.map(({x,alasan})=>`<li><div><b>${esc(x.nama)}</b><div class="muted">${esc(x.kelas?'Kelas '+x.kelas+' · ':'')}${esc(namaGudep(x.gudep))}</div></div><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${alasan.join('')}</div></li>`).join('')}</ul>`
    :'<p class="muted">Tidak ada. Semua siswa rajin hadir dan iurannya lancar.</p>';

  function bagianAgenda(){
    if(agd.error) return `<section class="card"><h2>Agenda</h2><div id="agenda-galat"></div></section>`;
    const boleh=p.role!=='siswa';
    const list=(agd.data||[]).filter(a=>!a.gudep||p.role==='mabigus'||a.gudep===p.gudep).slice(0,5);
    return `<section class="card"><div class="kepala-bagian"><h2>Agenda</h2>${boleh?'<button class="btn kecil kedua" id="tambah-agenda" type="button">+ Tambah</button>':''}</div>
      ${boleh?`<form id="form-agenda" hidden style="margin-top:6px"><div class="baris-form"><div><label for="ag-tgl">Tanggal</label><input type="date" id="ag-tgl" required value="${hariIni()}"></div>
        <div><label for="ag-judul">Kegiatan</label><input id="ag-judul" required maxlength="80" placeholder="mis. Persami di sekolah"></div></div>
        <label for="ag-ket">Keterangan (opsional)</label><input id="ag-ket" maxlength="160" placeholder="mis. Bawa tenda dan matras">
        <button class="btn" style="margin-top:10px">Simpan agenda</button></form>`:''}
      ${list.length?`<ul class="daftar" style="margin-top:8px">${list.map(a=>`<li><div><b>${esc(a.judul)}</b><div class="muted">${esc(tglPanjang(a.tanggal))}${a.keterangan?' · '+esc(a.keterangan):''}</div></div>
        <span class="pil">${esc(a.gudep?GUDEP[a.gudep]||a.gudep:'Semua')}</span>${boleh&&(p.role==='mabigus'||a.gudep===p.gudep)?`<button class="tombol-hapus" data-id="${esc(a.id)}" aria-label="Hapus agenda ${esc(a.judul)}">✕</button>`:''}</li>`).join('')}</ul>`
        :'<p class="muted" style="margin-top:8px">Belum ada agenda mendatang.</p>'}</section>`;
  }
  function pasangAgenda(){
    if(agd.error){tampilError(document.getElementById('agenda-galat'),'Agenda gagal dimuat',agd.error);return}
    const f=document.getElementById('form-agenda'); if(!f) return;
    document.getElementById('tambah-agenda').onclick=()=>{f.hidden=!f.hidden;if(!f.hidden)document.getElementById('ag-judul').focus()};
    f.onsubmit=async e=>{e.preventDefault();
      const {error}=await db.from('agenda').insert({tanggal:document.getElementById('ag-tgl').value,judul:document.getElementById('ag-judul').value.trim(),
        keterangan:document.getElementById('ag-ket').value.trim()||null,gudep:p.role==='pembina'?p.gudep:null});
      if(error) return toast('Gagal menyimpan agenda: '+error.message);
      location.reload();
    };
    document.querySelectorAll('.tombol-hapus').forEach(b=>b.onclick=async()=>{
      if(b.dataset.yakin!=='1'){b.dataset.yakin='1';b.textContent='Hapus?';setTimeout(()=>{b.dataset.yakin='';b.textContent='✕'},3000);return}
      const {error}=await db.from('agenda').delete().eq('id',b.dataset.id);
      if(error) return toast('Gagal menghapus: '+error.message);
      b.closest('li').remove();toast('Agenda dihapus');
    });
  }

  /* ---------- Tampilan per peran ---------- */
  if(p.role==='pembina'){
    const h=hitung(siswa);
    isi.innerHTML=`<div><div class="label">${esc(namaGudep(p.gudep))}</div><h1>Halo, Kak ${esc(p.nama.split(' ')[0])}</h1></div>
      <div class="grid">
        ${kartu('Siswa aktif',siswa.length,'anggota')}
        ${kartu('Kehadiran',h.pct+'%',`${h.hadir} dari ${h.total} catatan`)}
        ${kartu('Saldo kas',rupiah(h.masuk-h.keluar),`Masuk ${rupiah(h.masuk)} · Keluar ${rupiah(h.keluar)}`)}
        ${kartu('SKU lulus',h.skuN,h.siap?`<span class="pil hijau">${h.siap} siap dilantik</span>`:'butir materi')}
      </div>
      <a class="btn" href="absensi.html">${ikon('absen')} Absen hari ini</a>
      <div class="ubin-grid">
        ${ubin('anggota.html#tambah','anggota','Tambah siswa','atau ubah data siswa')}
        ${ubin('barung.html','barung','Barung &amp; Regu',`${new Set(siswa.map(s=>s.barung).filter(Boolean)).size} kelompok`)}
        ${ubin('pelantikan.html','pelantikan','Pelantikan',menunggu.length?`${menunggu.length} menunggu mabigus`:h.siap?`${h.siap} siap diajukan`:'ajukan &amp; pantau')}
        ${ubin('kelola_sku.html','sku','Butir SKU','tambah &amp; ubah kecakapan')}
        ${ubin('rekap.html','rekap','Rekap','unduh &amp; cetak')}
      </div>
      <section class="card"><h2>Kehadiran 8 latihan terakhir</h2>${grafik(h.seri)}</section>
      <section class="card"><div class="kepala-bagian"><h2>Perlu perhatian</h2><span class="pil ${h.perhatian.length?'merah':'hijau'}">${h.perhatian.length} siswa</span></div><div style="margin-top:6px">${daftarPerhatian(h.perhatian)}</div></section>
      ${bagianAgenda()}`;
  } else if(p.role==='mabigus'){
    const per=Object.keys(GUDEP).map(g=>({g,daftar:siswa.filter(s=>s.gudep===g)})).map(o=>({...o,h:hitung(o.daftar)}));
    const semua=hitung(siswa);
    isi.innerHTML=`<div><div class="label">Mabigus · semua Gudep</div><h1>${esc(p.nama)}</h1></div>
      ${menunggu.length?`<a class="sorotan" href="pelantikan.html">${ikon('pelantikan')}<span><b>${menunggu.length} pengajuan pelantikan menunggu persetujuan</b><small>Ketuk untuk memeriksa dan memutuskan</small></span><span aria-hidden="true">›</span></a>`:''}
      <div class="ubin-grid">
        ${ubin('pembina.html','pembina','Pembina','tambah &amp; ubah')}
        ${ubin('barung.html','barung','Barung &amp; Regu',`${new Set(siswa.filter(s=>s.barung).map(s=>s.gudep+'|'+s.barung)).size} kelompok`)}
        ${ubin('pelantikan.html','pelantikan','Pelantikan',menunggu.length?`${menunggu.length} menunggu`:'tidak ada antrean')}
        ${ubin('kelola_sku.html','sku','Butir SKU','tambah &amp; ubah')}
      </div>
      <div class="grid lebar">${per.map(({g,daftar,h})=>`<section class="card"><div class="kepala-bagian"><h2>${esc(namaGudep(g))}</h2></div>
        <div class="stat">${h.pct}%</div><div class="muted">kehadiran · ${daftar.length} siswa</div>
        <div class="progres" style="margin:8px 0 10px"><i style="width:${h.pct}%"></i></div>
        <ul class="daftar"><li><span class="muted">Saldo kas</span><b>${rupiah(h.masuk-h.keluar)}</b></li><li><span class="muted">SKU lulus</span><b>${h.skuN} butir</b></li>
        <li><span class="muted">Siap dilantik</span><b>${h.siap} siswa</b></li><li><span class="muted">Perlu perhatian</span><b>${h.perhatian.length} siswa</b></li></ul></section>`).join('')}</div>
      <a class="btn kedua" href="rekap.html">${ikon('rekap')} Lihat rekap lengkap</a>
      <section class="card"><h2>Kehadiran 8 latihan terakhir (gabungan)</h2>${grafik(semua.seri)}</section>
      <section class="card"><div class="kepala-bagian"><h2>Perlu perhatian</h2><span class="pil ${semua.perhatian.length?'merah':'hijau'}">${semua.perhatian.length} siswa</span></div><div style="margin-top:6px">${daftarPerhatian(semua.perhatian)}</div></section>
      ${bagianAgenda()}`;
  } else {
    const a=abs.data.filter(r=>r.siswa_id===p.id).sort((x,y)=>y.tanggal.localeCompare(x.tanggal));
    const hadir=a.filter(r=>r.status==='H').length, pct=a.length?Math.round(hadir/a.length*100):0;
    const r=iur.data.find(r=>r.tahun===tahun)||{};
    const lunas=BULAN.filter(b=>r[b]).length, kurang=BULAN.slice(0,bulanIni+1).filter(b=>!r[b]).length;
    const lulus=new Set(sku.data.map(x=>x.kode_sku)), {tk,pr,siap}=statusSiswaSku(p,lulus);
    const ajuanSaya=menunggu.find(m=>m.siswa_id===p.id);
    const STATUS={H:['Hadir','hijau'],S:['Sakit','kuning'],I:['Izin',''],A:['Alfa','merah']};
    isi.innerHTML=`<section class="card"><div class="label">${esc(namaGudep(p.gudep))}${p.kelas?' · Kelas '+esc(p.kelas):''}</div><h1>${esc(p.nama)}</h1>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${p.tingkat_dilantik?`<span class="pil hijau">Dilantik ${esc(TINGKAT[p.tingkat_dilantik])}</span>`:`<span class="pil">Calon ${GOLONGAN[tk]==='penggalang'?'Penggalang':'Siaga'}</span>`}
          ${p.tingkat_dilantik!==tk?`<span class="pil">Menempuh SKU ${esc(TINGKAT_PENDEK[tk])}</span>`:''}${p.barung?`<span class="pil">${namaKelompok(tk)} ${esc(p.barung)}</span>`:''}</div>
        ${ajuanSaya?`<p class="info" style="margin-top:10px">Pelantikan ${esc(TINGKAT[ajuanSaya.tingkat])} sudah diajukan pembina dan menunggu persetujuan mabigus.</p>`:''}</section>
      <div class="grid">${kartu('Kehadiran',pct+'%',`${hadir} dari ${a.length} latihan`)}${kartu('Iuran '+tahun,lunas+'/12',kurang?`<span class="pil kuning">kurang ${kurang} bulan</span>`:'<span class="pil hijau">lancar</span>')}
        ${kartu('SKU '+TINGKAT_PENDEK[tk],`${pr[tk].lulus}/${pr[tk].total}`,siap?'<span class="pil hijau">siap dilantik</span>':'butir lulus')}</div>
      <section class="card"><h2>Iuran ${tahun}</h2><div class="bulan12">${BULAN.map((b,i)=>`<span class="${r[b]?'lunas':i<=bulanIni?'telat':''}" title="${NAMA_BULAN[i]}: ${r[b]?'lunas':'belum'}">${NAMA_BULAN[i]}</span>`).join('')}</div>
        <p class="muted" style="margin-top:8px">Hijau = lunas · garis merah = belum dibayar</p></section>
      <section class="card"><h2>Kecakapan (SKU)</h2><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${tingkatSegolongan(tk).map(t=>`<div>
        <div class="kepala-bagian" style="margin:0 0 4px"><span>${esc(TINGKAT[t])}</span><span class="muted">${pr[t].lulus}/${pr[t].total}</span></div>
        <div class="progres ${skuPenuh(pr[t])?'penuh':''}"><i style="width:${lebarPersen(pr[t])}%"></i></div></div>`).join('')}</div>
        <details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Lihat butir ${esc(TINGKAT[tk])}</summary><ul class="daftar" style="margin-top:6px">${MATERI_SKU[tk].map(([k,t])=>
          `<li><span>${esc(t)}</span>${lulus.has(k)?'<span class="pil hijau">✓ Lulus</span>':'<span class="pil">Belum</span>'}</li>`).join('')}</ul></details></section>
      <section class="card"><h2>Riwayat latihan</h2>${a.length?`<ul class="daftar" style="margin-top:6px">${a.slice(0,8).map(x=>
        `<li><span>${esc(tglPanjang(x.tanggal))}</span><span class="pil ${STATUS[x.status]?.[1]||''}">${STATUS[x.status]?.[0]||esc(x.status)}</span></li>`).join('')}</ul>`:'<p class="muted">Belum ada absensi.</p>'}</section>
      ${bagianAgenda()}`;
  }
  pasangAgenda();
})();
