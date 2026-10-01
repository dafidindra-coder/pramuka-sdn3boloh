// Halaman login
(async()=>{ const {data:{session}}=await db.auth.getSession(); if(session) location.href='dashboard.html'; })();
document.getElementById('form').addEventListener('submit', async e=>{
  e.preventDefault();
  const pesan=document.getElementById('pesan'), tombol=document.getElementById('tombol');
  pesan.hidden=true; tombol.disabled=true; tombol.textContent='Memproses…';
  try{
    const email=document.getElementById('nis').value.trim()+DOMAIN_EMAIL; // NIS/NIP -> email
    const {error}=await db.auth.signInWithPassword({email,password:document.getElementById('pw').value});
    if(error) throw error;
    location.href='dashboard.html';
  }catch(err){
    pesan.textContent=/invalid/i.test(err.message)?'NIS/NIP atau kata sandi salah.':'Gagal masuk: '+err.message;
    pesan.hidden=false;
  }finally{tombol.disabled=false;tombol.textContent='Masuk'}
});
