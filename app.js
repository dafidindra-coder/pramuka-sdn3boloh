// Halaman login
(async()=>{ const {data:{session}}=await db.auth.getSession(); if(session) location.href='dashboard.html'; })();
document.getElementById('form').addEventListener('submit', async e=>{
  e.preventDefault();
  const pesan=document.getElementById('pesan'), tombol=document.getElementById('tombol');
  pesan.hidden=true; tombol.disabled=true; tombol.textContent='Memproses…';
  try{
    // Ambil bagian sebelum "@" (jaga-jaga bila browser/pengguna mengisi email lengkap), lalu tambah domain
    const nis=document.getElementById('nis').value.trim().split('@')[0];
    const email=nis+DOMAIN_EMAIL; // NIS/NIP -> email
    const {error}=await db.auth.signInWithPassword({email,password:document.getElementById('pw').value});
    if(error) throw error;
    location.href='dashboard.html';
  }catch(err){
    if(/not confirmed/i.test(err.message)) pesan.textContent='Akun belum dikonfirmasi. Minta admin mengaktifkan akun (Auto Confirm).';
    else if(/invalid/i.test(err.message)) pesan.textContent='NIS/NIP atau kata sandi salah. (detail: '+err.message+')';
    else pesan.textContent='Gagal masuk: '+err.message;
    pesan.hidden=false;
  }finally{tombol.disabled=false;tombol.textContent='Masuk'}
});
