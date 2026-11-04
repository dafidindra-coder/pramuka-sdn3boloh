/*
 * Aplikasi Presensi Siswa
 * Hak cipta (c) 2026 Dafid Indra Jaya Ningrat. Hak cipta dilindungi.
 */
import { firebaseConfig as configAsli } from './firebase-config.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  runTransaction, writeBatch, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ---------- mode uji lokal (Firebase Emulator) ---------- */
// Dibuka dari localhost → otomatis memakai emulator, tidak menyentuh project asli.
const LOKAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const firebaseConfig = LOKAL
  ? { apiKey: 'demo-key', authDomain: 'demo-presensi.firebaseapp.com', projectId: 'demo-presensi', appId: 'demo' }
  : configAsli;
const pakaiEmulator = a => { if (LOKAL) connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); return a; };

/* ---------- logo & ikon ---------- */
// Logo sekolah. Ganti logo.webp (tajam, untuk tampilan & cetak) dan logo-latar.webp (versi buram untuk latar kartu).
const LOGO_URL = 'logo.webp';
const LOGO_LATAR_URL = 'logo-latar.webp';
// Semboyan sekolah, tampil di pita bawah kartu siswa.
const MOTTO = 'Berakhlak • Berilmu • Berprestasi';
const HAK_CIPTA = '© 2026 Dafid Indra Jaya Ningrat';
const IKON = {
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  harian: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4"/>',
  laporan: '<path d="M3 21h18M6 17v-5M11 17V7M16 17v-8M21 17v-3"/>',
  siswa: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  kartu: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M8.5 15a3.5 3.5 0 0 1 7 0M9 18.5h6"/>',
  guru: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11l2 2 4-4"/>',
  pengaturan: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  kamera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  cetak: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>',
  unduh: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'
};
const ikon = n => `<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true">${IKON[n]}</svg>`;
const ikonJudul = n => `<span class="ikon-judul" style="--warna:var(--c-${n})">${ikon(n)}</span>`;

/* ---------- utilitas ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const tglHariIni = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const jamSekarang = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtTanggal = t => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtBulan = b => new Date(b + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const urutTeks = (a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
const STATUS = { H: 'Hadir', T: 'Terlambat', I: 'Izin', S: 'Sakit', A: 'Alpa' };
const NIS_VALID = /^[A-Za-z0-9._-]{1,40}$/;

function acak(n = 6) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return [...a].map(x => abc[x % abc.length]).join('');
}
const KUNCI = 'presensi:' + firebaseConfig.projectId + ':';
const simpanLokal = (k, v) => { try { localStorage.setItem(KUNCI + k, JSON.stringify(v)); } catch { /* penuh/diblokir */ } };
const ambilLokal = k => { try { return JSON.parse(localStorage.getItem(KUNCI + k)); } catch { return null; } };

function pesanError(e) {
  const kode = e?.code || '';
  const peta = {
    'auth/invalid-credential': 'Email atau kata sandi salah.',
    'auth/wrong-password': 'Email atau kata sandi salah.',
    'auth/user-not-found': 'Email atau kata sandi salah.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/email-already-in-use': 'Email ini sudah terdaftar. Pakai email lain, atau hapus akun lamanya di Firebase Console → Authentication.',
    'auth/weak-password': 'Kata sandi minimal 6 karakter.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
    'auth/network-request-failed': 'Tidak ada koneksi internet.',
    'auth/configuration-not-found': 'Login email/kata sandi belum diaktifkan untuk project ini. Aktifkan di Firebase Console → Authentication → Sign-in method → Email/Password.',
    'auth/operation-not-allowed': 'Login email/kata sandi belum diaktifkan di Firebase Console → Authentication → Sign-in method.',
    'permission-denied': 'Akses ditolak. Akun Anda tidak punya izin untuk tindakan ini.',
    'resource-exhausted': 'Kuota gratis harian Firebase habis. Aplikasi bisa dipakai lagi setelah kuota direset (sekitar pukul 14.00–15.00 WIB).',
    'unavailable': 'Server tidak terjangkau. Periksa koneksi internet lalu coba lagi.',
    'failed-precondition': 'Server menolak permintaan. Muat ulang halaman lalu coba lagi.'
  };
  return peta[kode] || e?.message || 'Terjadi kesalahan.';
}

function toast(pesan, jenis = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + jenis; t.textContent = pesan;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), jenis === 'error' ? 6000 : 3500);
}

async function sibuk(btn, fn, teks = 'Menyimpan…') {
  const asli = btn.textContent; btn.disabled = true; btn.textContent = teks;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = asli; }
}

function bukaModal(html) {
  const r = $('#modal-root');
  r.innerHTML = `<div class="modal-latar"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  $$('[data-tutup]', r).forEach(b => b.onclick = tutupModal);
  $('.modal-latar', r).addEventListener('mousedown', e => { if (e.target.classList.contains('modal-latar')) tutupModal(); });
  setTimeout(() => $('input:not([readonly]),select,textarea', r)?.focus(), 30);
  return $('.modal', r);
}
function tutupModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupModal(); });

function unduhCSV(nama, baris) {
  const sel = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const isi = baris.map(r => r.map(sel).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + isi], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function cetak(mode) {
  document.body.dataset.cetak = mode;
  window.print();
}
window.addEventListener('afterprint', () => delete document.body.dataset.cetak);

let audioCtx;
function bunyi(ok) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = ok ? 880 : 220; g.gain.value = 0.15;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + (ok ? 0.12 : 0.35));
  } catch { /* tanpa suara */ }
  navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
}

/* ---------- Firebase ---------- */
const app = $('#app');
const belumDiisi = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('ISI');
let fb, auth, db;
if (!belumDiisi) {
  fb = initializeApp(firebaseConfig);
  auth = pakaiEmulator(getAuth(fb));
  db = getFirestore(fb);
  if (LOKAL) connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const S = {
  profil: null, namaSekolah: 'Presensi Siswa', pengaturan: { jamMasuk: '07:15' },
  siswa: [], siswaMap: new Map(), tab: 'scan', riwayat: [],
  cacheHarian: {}, cacheLap: {}, harianTgl: null, harianKelas: '', lapBulan: null, lapKelas: '',
  siswaKelas: '', kartuKelas: '', sedangSetup: false
};

/* ---------- data siswa (disimpan di perangkat, hanya diunduh ulang bila berubah) ---------- */
function setSiswa(data) {
  S.siswa = data.map(({ nis, nama, kelas, token, foto }) => ({ nis, nama, kelas, token, ...(foto ? { foto } : {}) }))
    .sort((a, b) => urutTeks(a.kelas, b.kelas) || urutTeks(a.nama, b.nama));
  S.siswaMap = new Map(S.siswa.map(s => [s.nis, s]));
}
const simpanCacheSiswa = versi => simpanLokal('siswa', { versi, data: S.siswa });
function naikkanVersi(batch) {
  const v = acak(12);
  batch.set(doc(db, 'meta', 'siswa'), { versi: v }, { merge: true });
  return v;
}
async function muatSiswa(paksa = false) {
  const meta = await getDoc(doc(db, 'meta', 'siswa'));
  const versi = meta.exists() ? meta.data().versi : null;
  const c = ambilLokal('siswa');
  if (!paksa && c && c.versi === versi && Array.isArray(c.data)) { setSiswa(c.data); return; }
  const snap = await getDocs(collection(db, 'siswa'));
  setSiswa(snap.docs.map(d => d.data()));
  simpanCacheSiswa(versi);
}
const daftarKelas = () => [...new Set(S.siswa.map(s => s.kelas))].sort(urutTeks);
const opsiKelas = (pilih, semua = true) =>
  (semua ? `<option value="">Semua kelas</option>` : '') +
  daftarKelas().map(k => `<option value="${esc(k)}" ${k === pilih ? 'selected' : ''}>Kelas ${esc(k)}</option>`).join('');

/* ---------- foto siswa ---------- */
// Foto disimpan di koleksi foto/{nis} sebagai JPEG kecil (±10–15 KB), bukan di Cloud Storage,
// supaya tetap di paket gratis. Data siswa hanya membawa penanda versi foto (siswa.foto),
// dan fotonya baru diunduh saat dibutuhkan: saat scan dan saat mencetak kartu.
const FOTO_VALID = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const cacheFoto = new Map(); // nis -> { versi, janji }
function ambilFoto(s) {
  if (!s?.foto) return Promise.resolve(null);
  const c = cacheFoto.get(s.nis);
  if (c && c.versi === s.foto) return c.janji;
  const janji = getDoc(doc(db, 'foto', s.nis))
    .then(d => { const u = d.exists() ? d.data().data : null; return FOTO_VALID.test(u || '') ? u : null; })
    .catch(() => { cacheFoto.delete(s.nis); return null; });
  cacheFoto.set(s.nis, { versi: s.foto, janji });
  return janji;
}
const inisial = nama => String(nama || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const htmlFoto = (url, nama) => url && FOTO_VALID.test(url)
  ? `<img src="${url}" alt="Foto ${esc(nama)}">`
  : `<span class="foto-kosong" aria-hidden="true">${esc(inisial(nama))}</span>`;
// Potong tengah 4:5 lalu perkecil ke 240×300 piksel, JPEG.
async function kecilkanFoto(file) {
  if (!/^image\//.test(file.type)) throw new Error(`${file.name} bukan file gambar.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, gagal) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => gagal(new Error(`${file.name} tidak bisa dibuka.`)); i.src = url;
    });
    const W = 240, H = 300, r = W / H;
    let sw = img.naturalWidth, sh = img.naturalHeight;
    if (sw / sh > r) sw = sh * r; else sh = sw / r;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    cx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
    return cv.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}
// Tulis foto ke batch; mengembalikan penanda versi baru untuk disimpan di data siswa.
function tulisFoto(b, nis, data) {
  b.set(doc(db, 'foto', nis), { nis, data });
  const versi = acak(8);
  cacheFoto.set(nis, { versi, janji: Promise.resolve(data) });
  return versi;
}

/* ---------- inti presensi ---------- */
// Mengubah status satu siswa pada satu tanggal, sekaligus memperbarui rekap bulanannya.
async function setStatus(s, status, tgl, { scan = false } = {}) {
  const bulan = tgl.slice(0, 7);
  const aRef = doc(db, 'absensi', `${tgl}_${s.nis}`);
  const rRef = doc(db, 'rekap', `${bulan}_${s.nis}`);
  const jam = jamSekarang();
  const hasil = await runTransaction(db, async tx => {
    const snap = await tx.get(aRef);
    const lama = snap.exists() ? snap.data() : null;
    if (scan && lama) return { dup: true, data: lama };
    if ((lama?.status || null) === status) return { sama: true, data: lama };
    const r = { nis: s.nis, nama: s.nama, kelas: s.kelas, bulan };
    if (lama) r[lama.status] = increment(-1);
    let data = null;
    if (status) {
      data = {
        nis: s.nis, nama: s.nama, kelas: s.kelas, tanggal: tgl, bulan, status,
        jam: (!scan && lama?.jam) ? lama.jam : jam, cara: scan ? 'scan' : 'manual',
        oleh: S.profil.nama, olehUid: S.profil.uid
      };
      r[status] = increment(1);
      tx.set(aRef, { ...data, waktu: serverTimestamp() });
    } else {
      tx.delete(aRef);
    }
    tx.set(rRef, r, { merge: true });
    return { ok: true, data };
  });
  if (hasil.ok) {
    const m = S.cacheHarian[tgl];
    if (m) { if (hasil.data) m.set(s.nis, hasil.data); else m.delete(s.nis); }
    delete S.cacheLap[bulan];
    if (status) tandaiHari(tgl);
  }
  return hasil;
}

// Hari efektif = hari yang pernah ada presensi. Dipakai untuk menghitung Alpa tanpa Cloud Functions.
function tandaiHari(tgl) {
  const tanda = ambilLokal('hari') || {};
  if (tanda[tgl]) return;
  setDoc(doc(db, 'hari', tgl), { tanggal: tgl, bulan: tgl.slice(0, 7) }, { merge: true })
    .then(() => { tanda[tgl] = 1; simpanLokal('hari', Object.fromEntries(Object.entries(tanda).slice(-60))); })
    .catch(() => { /* dicoba lagi pada presensi berikutnya */ });
}

/* ---------- login & setup ---------- */
function renderMuat(teks = 'Memuat…') { app.innerHTML = `<div class="layar-tengah"><p class="muted">${esc(teks)}</p></div>`; }

function renderBelumDiisi() {
  app.innerHTML = `<main class="layar-tengah"><div class="kartu-form">
    <h1>Konfigurasi Firebase belum diisi</h1>
    <p>Buka file <b>public/firebase-config.js</b>, tempel konfigurasi dari Firebase Console (Project settings → Your apps → Web app), lalu deploy ulang.</p>
    <p class="muted kecil">Langkah lengkapnya ada di README.md.</p></div></main>`;
}

function renderLogin(perluSetup) {
  if (perluSetup) {
    app.innerHTML = `<main class="layar-tengah"><form class="kartu-form" id="fSetup">
      <img class="logo-besar" src="${LOGO_URL}" alt="Logo sekolah">
      <h1>Siapkan aplikasi presensi</h1>
      <p class="muted">Langkah ini hanya sekali. Akun yang dibuat di sini menjadi akun kepala sekolah, yang nanti menambahkan akun guru.</p>
      <label>Nama sekolah<input name="sekolah" required placeholder="SMP Negeri 1 Contoh"></label>
      <label>Nama kepala sekolah<input name="nama" required autocomplete="name"></label>
      <label>Email<input name="email" type="email" required autocomplete="username"></label>
      <label>Kata sandi<input name="pw" type="password" minlength="6" required autocomplete="new-password"></label>
      <button class="btn utama lebar">Buat akun kepala sekolah</button>
      <p class="hak-cipta-form">${HAK_CIPTA}</p>
    </form></main>`;
    $('#fSetup').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      await sibuk(e.submitter || $('#fSetup button'), async () => {
        S.sedangSetup = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth, f.get('email').trim(), f.get('pw'));
          const b = writeBatch(db);
          b.set(doc(db, 'users', cred.user.uid), {
            nama: f.get('nama').trim(), email: cred.user.email, role: 'kepala', aktif: true, dibuat: serverTimestamp()
          });
          b.set(doc(db, 'config', 'setup'), { namaSekolah: f.get('sekolah').trim(), oleh: cred.user.uid, waktu: serverTimestamp() });
          await b.commit();
          S.sedangSetup = false;
          await masuk(cred.user);
        } catch (err) {
          S.sedangSetup = false;
          toast(pesanError(err), 'error');
          if (auth.currentUser) await signOut(auth);
        }
      }, 'Menyiapkan…');
    };
    return;
  }
  app.innerHTML = `<main class="layar-tengah"><form class="kartu-form" id="fLogin">
    <img class="logo-besar" src="${LOGO_URL}" alt="Logo sekolah">
    <div class="tengah"><h1>${esc(S.namaSekolah)}</h1><p class="muted">Masuk untuk mencatat presensi siswa.</p></div>
    <label>Email<input name="email" type="email" required autocomplete="username"></label>
    <label>Kata sandi<input name="pw" type="password" required autocomplete="current-password"></label>
    <button class="btn utama lebar">Masuk</button>
    <button type="button" class="btn tipis lebar" id="btnLupa">Lupa kata sandi</button>
    <p class="hak-cipta-form">${HAK_CIPTA}</p>
  </form></main>`;
  $('#fLogin').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await sibuk($('#fLogin .utama'), async () => {
      try { await signInWithEmailAndPassword(auth, f.get('email').trim(), f.get('pw')); }
      catch (err) { toast(pesanError(err), 'error'); }
    }, 'Masuk…');
  };
  $('#btnLupa').onclick = async () => {
    const email = $('#fLogin [name=email]').value.trim();
    if (!email) { toast('Isi email Anda dulu, lalu tekan Lupa kata sandi.'); $('#fLogin [name=email]').focus(); return; }
    try { await sendPasswordResetEmail(auth, email); toast('Tautan atur ulang kata sandi dikirim ke ' + email, 'ok'); }
    catch (err) { toast(pesanError(err), 'error'); }
  };
}

function renderDitolak(teks) {
  app.innerHTML = `<main class="layar-tengah"><div class="kartu-form">
    <h1>Akun belum bisa dipakai</h1><p>${esc(teks)}</p>
    <button class="btn utama" id="btnKeluar2">Keluar</button></div></main>`;
  $('#btnKeluar2').onclick = () => signOut(auth);
}

async function masuk(u) {
  renderMuat('Memuat data sekolah…');
  try {
    const p = await getDoc(doc(db, 'users', u.uid));
    if (!p.exists()) return renderDitolak('Akun ini tidak terdaftar sebagai guru atau kepala sekolah. Hubungi kepala sekolah.');
    if (p.data().aktif !== true) return renderDitolak('Akun ini sedang dinonaktifkan. Hubungi kepala sekolah.');
    S.profil = { uid: u.uid, ...p.data() };
    const [setup, peng] = await Promise.all([getDoc(doc(db, 'config', 'setup')), getDoc(doc(db, 'config', 'pengaturan'))]);
    S.namaSekolah = setup.data()?.namaSekolah || 'Presensi Siswa';
    if (peng.exists()) S.pengaturan = { ...S.pengaturan, ...peng.data() };
    await muatSiswa();
    renderApp();
  } catch (e) {
    app.innerHTML = `<main class="layar-tengah"><div class="kartu-form"><h1>Data gagal dimuat</h1>
      <p>${esc(pesanError(e))}</p><button class="btn utama" id="btnUlang">Coba lagi</button>
      <button class="btn tipis" id="btnKeluar3">Keluar</button></div></main>`;
    $('#btnUlang').onclick = () => masuk(u);
    $('#btnKeluar3').onclick = () => signOut(auth);
  }
}

/* ---------- kerangka aplikasi ---------- */
const TABS = [
  ['scan', 'Scan'], ['harian', 'Harian'], ['laporan', 'Laporan'], ['siswa', 'Siswa'],
  ['kartu', 'Kartu QR'], ['guru', 'Guru', true], ['pengaturan', 'Pengaturan', true]
];
const isKepala = () => S.profil?.role === 'kepala';

function renderApp() {
  app.innerHTML = `
    <header class="kepala no-print"><div class="kepala-dalam">
      <img class="logo" src="${LOGO_URL}" alt="">
      <div class="kepala-teks"><p class="sekolah">${esc(S.namaSekolah)}</p>
      <p class="peran">${esc(S.profil.nama)}, ${isKepala() ? 'Kepala Sekolah' : 'Guru'}</p></div>
      <button class="btn kecil btn-kaca" id="btnKeluar">Keluar</button>
    </div></header>
    <nav class="tab no-print" aria-label="Menu"><div class="tab-dalam">
      ${TABS.filter(t => !t[2] || isKepala()).map(([id, l]) => `<button data-tab="${id}" class="${S.tab === id ? 'aktif' : ''}" style="--warna:var(--c-${id})">${ikon(id)}${l}</button>`).join('')}
    </div></nav>
    <main id="main"></main>
    <footer class="hak-cipta no-print"><div class="hak-cipta-dalam">
      <img src="${LOGO_URL}" alt=""><span>Aplikasi Presensi Siswa ${esc(S.namaSekolah)}</span><b>${HAK_CIPTA}. Hak cipta dilindungi.</b>
    </div></footer>`;
  $('#btnKeluar').onclick = async () => { await hentikanKamera(); await signOut(auth); };
  $$('nav.tab button').forEach(b => b.onclick = () => gantiTab(b.dataset.tab));
  renderTab();
}
async function gantiTab(t) {
  if (S.tab === 'scan' && t !== 'scan') await hentikanKamera();
  S.tab = t;
  $$('nav.tab button').forEach(b => b.classList.toggle('aktif', b.dataset.tab === t));
  $('nav.tab button.aktif')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  renderTab();
  window.scrollTo(0, 0);
}
function renderTab() {
  const m = $('#main');
  const v = { scan: viewScan, harian: viewHarian, laporan: viewLaporan, siswa: viewSiswa, kartu: viewKartu, guru: viewGuru, pengaturan: viewPengaturan }[S.tab];
  (v || viewScan)(m);
}

/* ---------- SCAN ---------- */
let scanner = null, kunciScan = false, terakhir = { teks: '', waktu: 0 };

function viewScan(m) {
  m.innerHTML = `<section class="scan">
    <div class="scan-kiri">
      <div class="scan-kamera"><div id="reader"></div><div class="bidik" aria-hidden="true"><span></span></div><p class="scan-kosong">${ikon('scan')}Kamera belum aktif</p></div>
      <button id="btnKamera" class="btn utama lebar">${ikon('kamera')}Mulai scan</button>
      <p class="muted kecil">Jam masuk ${esc(S.pengaturan.jamMasuk)}. Scan setelah jam ini dicatat Terlambat. Satu siswa hanya tercatat sekali per hari.</p>
    </div>
    <div>
      <div id="stempel" class="stempel kosong"><p>Arahkan kamera ke kartu QR siswa.</p></div>
      <h2 class="sub">Scan terakhir dari perangkat ini</h2>
      <ol id="riwayat" class="riwayat"></ol>
    </div>
  </section>`;
  $('#btnKamera').onclick = async () => {
    if (scanner) { await hentikanKamera(); viewScan(m); }
    else await mulaiKamera();
  };
  renderRiwayat();
}

async function mulaiKamera() {
  if (!window.Html5Qrcode) { toast('Komponen scanner gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.', 'error'); return; }
  const btn = $('#btnKamera'); btn.disabled = true;
  try {
    // Seluruh gambar kamera dipindai (tanpa qrbox bawaan), jadi bingkai bidik buatan sendiri selalu tepat di tengah.
    scanner = new Html5Qrcode('reader', {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 12, aspectRatio: 1 },
      onScan, () => {}
    );
    $('.scan-kamera').classList.add('aktif');
    btn.textContent = 'Hentikan kamera';
  } catch {
    scanner = null;
    toast('Kamera tidak bisa dibuka. Izinkan akses kamera di browser, dan pastikan aplikasi dibuka lewat alamat https.', 'error');
  } finally { btn.disabled = false; }
}
async function hentikanKamera() {
  if (!scanner) return;
  try { await scanner.stop(); scanner.clear(); } catch { /* sudah berhenti */ }
  scanner = null;
}

async function onScan(teks) {
  const now = Date.now();
  if (kunciScan) return;
  if (teks === terakhir.teks && now - terakhir.waktu < 4000) return;
  terakhir = { teks, waktu: now };
  kunciScan = true;
  try { await prosesKode(teks); } finally { setTimeout(() => { kunciScan = false; }, 700); }
}

async function prosesKode(teks) {
  const m = /^ABSEN:([^:]+):([A-Z0-9]+)$/.exec(String(teks).trim());
  if (!m) { tampilStempel({ gagal: 'QR tidak dikenal', sub: 'Ini bukan kartu presensi dari aplikasi ini.' }); bunyi(false); return; }
  const [, nis, token] = m;
  let s = S.siswaMap.get(nis);
  if (!s) {
    try { await muatSiswa(true); s = S.siswaMap.get(nis); } catch { /* lanjut */ }
  }
  if (!s) { tampilStempel({ gagal: 'Siswa tidak terdaftar', sub: `NIS ${nis} tidak ada di data siswa.` }); bunyi(false); return; }
  if (s.token !== token) {
    tampilStempel({ gagal: 'Kartu tidak berlaku', sub: `${s.nama} sudah dibuatkan kartu baru. Kartu ini tidak bisa dipakai lagi.` });
    bunyi(false); return;
  }
  ambilFoto(s); // mulai unduh foto bersamaan dengan pencatatan
  const jam = jamSekarang();
  const status = jam > S.pengaturan.jamMasuk ? 'T' : 'H';
  try {
    const r = await setStatus(s, status, tglHariIni(), { scan: true });
    if (r.dup) {
      tampilStempel({ s, status: r.data.status, dup: true, sub: `Sudah tercatat pukul ${r.data.jam}${r.data.oleh ? ' oleh ' + r.data.oleh : ''}.` });
      bunyi(false);
    } else {
      tampilStempel({ s, status, sub: `Tercatat pukul ${jam}.` });
      bunyi(true);
      S.riwayat.unshift({ jam, nama: s.nama, kelas: s.kelas, status });
      S.riwayat = S.riwayat.slice(0, 15);
      renderRiwayat();
    }
  } catch (e) {
    tampilStempel({ gagal: 'Belum tersimpan', sub: pesanError(e) + ' Scan ulang kartu ini.' });
    terakhir = { teks: '', waktu: 0 };
    bunyi(false);
  }
}

function tampilStempel({ s, status, sub, dup, gagal }) {
  const el = $('#stempel'); if (!el) return;
  if (gagal) {
    el.className = 'stempel gagal';
    el.innerHTML = `<p class="stempel-judul">${esc(gagal)}</p><p>${esc(sub)}</p>`;
  } else {
    el.className = `stempel st-${status}${dup ? ' dup' : ''}`;
    el.innerHTML = `<div class="stempel-isi">
      <div class="stempel-foto" data-nis="${esc(s.nis)}">${htmlFoto(null, s.nama)}</div>
      <div class="stempel-info"><p class="stempel-nama">${esc(s.nama)}</p>
      <p class="muted">Kelas ${esc(s.kelas)}, NIS ${esc(s.nis)}</p>
      <span class="cap">${dup ? 'Sudah ' + STATUS[status].toLowerCase() : STATUS[status]}</span>
      <p class="kecil">${esc(sub)}</p></div></div>`;
    ambilFoto(s).then(url => {
      const box = $('#stempel .stempel-foto');
      if (url && box?.dataset.nis === s.nis) box.innerHTML = htmlFoto(url, s.nama);
    });
  }
  el.classList.remove('animasi'); void el.offsetWidth; el.classList.add('animasi');
}

function renderRiwayat() {
  const ol = $('#riwayat'); if (!ol) return;
  ol.innerHTML = S.riwayat.length
    ? S.riwayat.map(r => `<li><span class="angka muted">${r.jam}</span><span><b>${esc(r.nama)}</b> <span class="muted kecil">${esc(r.kelas)}</span></span><span class="chip st-${r.status}">${STATUS[r.status]}</span></li>`).join('')
    : `<li class="kosong">Belum ada scan.</li>`;
}

/* ---------- HARIAN ---------- */
async function muatHarian(tgl, paksa = false) {
  if (!paksa && S.cacheHarian[tgl]) return S.cacheHarian[tgl];
  const snap = await getDocs(query(collection(db, 'absensi'), where('tanggal', '==', tgl)));
  const m = new Map(); snap.forEach(d => m.set(d.data().nis, d.data()));
  S.cacheHarian[tgl] = m;
  return m;
}

function viewHarian(m) {
  S.harianTgl ||= tglHariIni();
  m.innerHTML = `<section><div class="no-print">
    <h1 class="judul-hal">${ikonJudul('harian')}Presensi harian</h1>
    <p class="muted kecil">Pakai halaman ini untuk siswa yang lupa membawa kartu, atau untuk mencatat izin dan sakit. Ketuk huruf yang sedang aktif untuk menghapus catatannya.</p>
    <div class="alat">
      <label>Tanggal<input type="date" id="hTgl" value="${S.harianTgl}" max="${tglHariIni()}"></label>
      <label>Kelas<select id="hKelas">${opsiKelas(S.harianKelas)}</select></label>
      <label>Cari<input type="search" id="hCari" placeholder="Nama atau NIS"></label>
      <div class="tombol"><button class="btn tipis" id="hMuat">Muat ulang</button>
        <button class="btn" id="hUnduh">${ikon('unduh')}Unduh CSV</button>
        <button class="btn emas" id="hCetak">${ikon('cetak')}Cetak laporan</button></div>
    </div>
    <div id="hRingkas" class="ringkas"></div>
    <div id="hDaftar"><p class="muted">Memuat…</p></div>
  </div><div id="hCetakIsi" class="hanya-cetak"></div></section>`;
  const muat = async paksa => {
    $('#hDaftar').innerHTML = `<p class="muted">Memuat…</p>`;
    try { await muatHarian(S.harianTgl, paksa); renderDaftarHarian(); }
    catch (e) { $('#hDaftar').innerHTML = `<p>${esc(pesanError(e))}</p>`; }
  };
  $('#hTgl').onchange = e => { S.harianTgl = e.target.value || tglHariIni(); muat(false); };
  $('#hKelas').onchange = e => { S.harianKelas = e.target.value; renderDaftarHarian(); };
  $('#hCari').oninput = () => renderDaftarHarian();
  $('#hMuat').onclick = () => muat(true);
  $('#hUnduh').onclick = unduhHarian;
  $('#hCetak').onclick = cetakHarian;
  $('#hDaftar').onclick = async e => {
    const b = e.target.closest('button[data-st]'); if (!b) return;
    const li = b.closest('li[data-nis]'); const s = S.siswaMap.get(li.dataset.nis);
    const data = S.cacheHarian[S.harianTgl]?.get(s.nis);
    const baru = data?.status === b.dataset.st ? null : b.dataset.st;
    if (!baru && !confirm(`Hapus catatan ${STATUS[data.status]} untuk ${s.nama}?`)) return;
    $$('button', li).forEach(x => x.disabled = true);
    try {
      await setStatus(s, baru, S.harianTgl);
      renderDaftarHarian();
    } catch (err) {
      toast(pesanError(err), 'error');
      $$('button', li).forEach(x => x.disabled = false);
    }
  };
  muat(false);
}

function barisHarian(s, a, no) {
  return `<li class="baris" data-nis="${esc(s.nis)}">
    <span class="no">${no}</span>
    <div><span class="nama">${esc(s.nama)}</span>
      <span class="muted kecil">NIS ${esc(s.nis)}${a ? `, ${STATUS[a.status]} ${a.cara === 'scan' ? 'pukul ' + a.jam : '(dicatat ' + esc(a.oleh || 'guru') + ')'}` : ', belum tercatat'}</span></div>
    <div class="seg" role="group" aria-label="Status ${esc(s.nama)}">
      ${['H', 'T', 'I', 'S'].map(k => `<button data-st="${k}" class="st-${k} ${a?.status === k ? 'aktif' : ''}" title="${STATUS[k]}" aria-pressed="${a?.status === k}">${k}</button>`).join('')}
    </div></li>`;
}

function renderDaftarHarian() {
  const data = S.cacheHarian[S.harianTgl]; if (!data) return;
  const kls = S.harianKelas;
  const cari = ($('#hCari')?.value || '').trim().toLowerCase();
  const dalamKelas = S.siswa.filter(s => !kls || s.kelas === kls);
  const n = { H: 0, T: 0, I: 0, S: 0, B: 0 };
  dalamKelas.forEach(s => { const a = data.get(s.nis); n[a ? a.status : 'B']++; });
  $('#hRingkas').innerHTML = ['H', 'T', 'I', 'S'].map(k => `<span class="chip st-${k}">${STATUS[k]} <b class="angka">${n[k]}</b></span>`).join('')
    + `<span class="chip st-B">Belum tercatat <b class="angka">${n.B}</b></span>`;
  const list = dalamKelas.filter(s => !cari || s.nama.toLowerCase().includes(cari) || s.nis.toLowerCase().includes(cari));
  if (!S.siswa.length) { $('#hDaftar').innerHTML = `<div class="kosong-besar"><p>Belum ada data siswa.</p><p class="kecil">Tambahkan siswa di menu Siswa.</p></div>`; return; }
  if (!list.length) { $('#hDaftar').innerHTML = `<p class="muted">Tidak ada siswa yang cocok.</p>`; return; }
  const grup = {};
  list.forEach(s => (grup[s.kelas] ||= []).push(s));
  $('#hDaftar').innerHTML = `<p class="muted kecil">${esc(fmtTanggal(S.harianTgl))}</p>` +
    Object.keys(grup).sort(urutTeks).map(k => {
      const ss = grup[k];
      const hadir = ss.filter(s => ['H', 'T'].includes(data.get(s.nis)?.status)).length;
      return `<section class="grup"><div class="grup-judul"><h3>Kelas ${esc(k)}</h3>
        <span class="muted kecil angka">${hadir} dari ${ss.length} hadir</span></div>
        <ol class="buku">${ss.map((s, i) => barisHarian(s, data.get(s.nis), i + 1)).join('')}</ol></section>`;
    }).join('');
}

// Laporan satu hari: daftar per siswa lalu ringkasan per kelas, untuk dibuka di Excel.
function unduhHarian() {
  const data = S.cacheHarian[S.harianTgl];
  if (!data) return toast('Data hari ini belum selesai dimuat.', 'error');
  const kls = S.harianKelas;
  const list = S.siswa.filter(s => !kls || s.kelas === kls);
  if (!list.length) return toast('Belum ada data siswa.', 'error');
  const kosong = S.harianTgl === tglHariIni() ? 'Belum tercatat' : 'Alpa';
  const rows = [
    [S.namaSekolah], ['Laporan presensi harian', fmtTanggal(S.harianTgl)], [kls ? 'Kelas ' + kls : 'Semua kelas'], [],
    ['No', 'Kelas', 'NIS', 'Nama', 'Status', 'Jam', 'Cara', 'Dicatat oleh']
  ];
  const grup = {};
  list.forEach(s => (grup[s.kelas] ||= []).push(s));
  const kelasUrut = Object.keys(grup).sort(urutTeks);
  let no = 0;
  kelasUrut.forEach(k => grup[k].forEach(s => {
    const a = data.get(s.nis);
    rows.push([++no, s.kelas, s.nis, s.nama, a ? STATUS[a.status] : kosong, a?.jam || '',
      a ? (a.cara === 'scan' ? 'Scan kartu' : 'Manual') : '', a?.oleh || '']);
  }));
  rows.push([], ['Ringkasan per kelas'], ['Kelas', 'Jumlah siswa', 'Hadir', 'Terlambat', 'Izin', 'Sakit', kosong, 'Persen kehadiran']);
  const tot = { n: 0, H: 0, T: 0, I: 0, S: 0, B: 0 };
  kelasUrut.forEach(k => {
    const n = { H: 0, T: 0, I: 0, S: 0, B: 0 };
    grup[k].forEach(s => n[data.get(s.nis)?.status || 'B']++);
    const jml = grup[k].length;
    Object.keys(n).forEach(x => tot[x] += n[x]); tot.n += jml;
    rows.push([k, jml, n.H, n.T, n.I, n.S, n.B, Math.round((n.H + n.T) / jml * 100)]);
  });
  if (kelasUrut.length > 1) rows.push(['Jumlah', tot.n, tot.H, tot.T, tot.I, tot.S, tot.B, Math.round((tot.H + tot.T) / tot.n * 100)]);
  unduhCSV(`presensi-harian-${S.harianTgl}${kls ? '-kelas-' + kls : ''}.csv`, rows);
}

// Kop surat & tanda tangan untuk laporan cetak
function kopCetak(judul, sub) {
  return `<div class="kop"><img src="${LOGO_URL}" alt=""><div><p class="kop-sekolah">${esc(S.namaSekolah)}</p>
    <p class="kop-judul">${esc(judul)}</p><p class="kop-sub">${esc(sub)}</p></div></div>`;
}
const kakiCetak = () => `<p class="cetak-hak">Dicetak dari Aplikasi Presensi Siswa · ${HAK_CIPTA}</p>`;
function ttdCetak(tgl) {
  const tanggal = fmtTanggal(tgl).replace(/^[^,]+,\s*/, '');
  return `<div class="ttd">
    <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div class="ttd-ruang"></div><p class="ttd-garis">(......................................)</p><p>NIP. ..............................</p></div>
    <div><p>${esc(tanggal)}</p><p>${isKepala() ? 'Kepala Sekolah' : 'Guru / Petugas'}</p><div class="ttd-ruang"></div><p class="ttd-garis">${esc(S.profil.nama)}</p><p>NIP. ..............................</p></div>
  </div>`;
}

// Laporan harian siap cetak: halaman rekap semua kelas, lalu satu halaman per kelas.
function cetakHarian() {
  const data = S.cacheHarian[S.harianTgl];
  if (!data) return toast('Data tanggal ini belum selesai dimuat.', 'error');
  const kls = S.harianKelas;
  const list = S.siswa.filter(s => !kls || s.kelas === kls);
  if (!list.length) return toast('Belum ada data siswa.', 'error');
  const hariIni = S.harianTgl === tglHariIni();
  const kodeKosong = hariIni ? 'B' : 'A', labelKosong = hariIni ? 'Belum tercatat' : 'Alpa';
  const grup = {}; list.forEach(s => (grup[s.kelas] ||= []).push(s));
  const kelasUrut = Object.keys(grup).sort(urutTeks);
  const hitung = ss => { const n = { H: 0, T: 0, I: 0, S: 0, X: 0 }; ss.forEach(s => n[data.get(s.nis)?.status || 'X']++); return n; };
  const persen = (n, j) => j ? Math.round((n.H + n.T) / j * 100) + '%' : '-';
  const tgl = fmtTanggal(S.harianTgl);
  let html = '';
  if (kelasUrut.length > 1) {
    const tot = { H: 0, T: 0, I: 0, S: 0, X: 0 }; let jml = 0;
    const baris = kelasUrut.map((k, i) => {
      const n = hitung(grup[k]); Object.keys(n).forEach(x => tot[x] += n[x]); jml += grup[k].length;
      return `<tr><td class="n">${i + 1}</td><td>Kelas ${esc(k)}</td><td class="n">${grup[k].length}</td><td class="n">${n.H}</td><td class="n">${n.T}</td><td class="n">${n.I}</td><td class="n">${n.S}</td><td class="n">${n.X}</td><td class="n">${persen(n, grup[k].length)}</td></tr>`;
    }).join('');
    html += `<section class="lembar">${kopCetak('REKAP PRESENSI HARIAN', `${tgl} · semua kelas`)}
      <table class="tabel-cetak"><thead><tr><th class="n">No</th><th>Kelas</th><th class="n">Siswa</th><th class="n">H</th><th class="n">T</th><th class="n">I</th><th class="n">S</th><th class="n">${kodeKosong}</th><th class="n">Hadir</th></tr></thead>
      <tbody>${baris}</tbody><tfoot><tr><th></th><th>Jumlah</th><th class="n">${jml}</th><th class="n">${tot.H}</th><th class="n">${tot.T}</th><th class="n">${tot.I}</th><th class="n">${tot.S}</th><th class="n">${tot.X}</th><th class="n">${persen(tot, jml)}</th></tr></tfoot></table>
      <p class="ringkas-cetak">H Hadir, T Terlambat, I Izin, S Sakit, ${kodeKosong} ${labelKosong}. Persen hadir = (H + T) dibagi jumlah siswa.</p>
      ${ttdCetak(S.harianTgl)}${kakiCetak()}</section>`;
  }
  html += kelasUrut.map(k => {
    const ss = grup[k], n = hitung(ss);
    const baris = ss.map((s, i) => {
      const a = data.get(s.nis);
      const st = a ? a.status : kodeKosong;
      const ket = a ? (a.cara === 'scan' ? 'Scan kartu' : `Dicatat ${a.oleh || 'guru'}`) : '';
      return `<tr><td class="n">${i + 1}</td><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td>
        <td class="stc st-${st}">${a ? STATUS[a.status] : labelKosong}</td><td>${a && ['H', 'T'].includes(a.status) ? esc(a.jam) : ''}</td><td>${esc(ket)}</td></tr>`;
    }).join('');
    return `<section class="lembar">${kopCetak('LAPORAN PRESENSI HARIAN', `${tgl} · Kelas ${k}`)}
      <table class="tabel-cetak"><thead><tr><th class="n">No</th><th>NIS</th><th>Nama siswa</th><th>Status</th><th>Jam</th><th>Keterangan</th></tr></thead><tbody>${baris}</tbody></table>
      <p class="ringkas-cetak"><b>Jumlah ${ss.length} siswa:</b> Hadir ${n.H}, Terlambat ${n.T}, Izin ${n.I}, Sakit ${n.S}, ${labelKosong} ${n.X}. Kehadiran ${persen(n, ss.length)}.</p>
      ${ttdCetak(S.harianTgl)}${kakiCetak()}</section>`;
  }).join('');
  $('#hCetakIsi').innerHTML = html;
  cetak('harian');
}

/* ---------- LAPORAN ---------- */
async function muatLaporan(bln, paksa = false) {
  if (!paksa && S.cacheLap[bln]) return S.cacheLap[bln];
  const [rs, hs] = await Promise.all([
    getDocs(query(collection(db, 'rekap'), where('bulan', '==', bln))),
    getDocs(query(collection(db, 'hari'), where('bulan', '==', bln)))
  ]);
  const rekap = new Map(); rs.forEach(d => rekap.set(d.data().nis, d.data()));
  const hari = hs.docs.map(d => d.id).sort();
  return (S.cacheLap[bln] = { rekap, hari });
}

function hitungBaris(s, lap) {
  const r = lap.rekap.get(s.nis) || {};
  const H = Math.max(0, r.H || 0), T = Math.max(0, r.T || 0), I = Math.max(0, r.I || 0), Sk = Math.max(0, r.S || 0);
  const he = lap.hari.length;
  const A = Math.max(0, he - (H + T + I + Sk));
  const persen = he ? Math.round((H + T) / he * 100) : null;
  return { H, T, I, S: Sk, A, persen };
}

function viewLaporan(m) {
  S.lapBulan ||= tglHariIni().slice(0, 7);
  m.innerHTML = `<section class="laporan">
    <div class="no-print">
      <h1 class="judul-hal">${ikonJudul('laporan')}Rekap bulanan per kelas</h1>
      <div class="alat">
        <label>Bulan<input type="month" id="lBulan" value="${S.lapBulan}" max="${tglHariIni().slice(0, 7)}"></label>
        <label>Kelas<select id="lKelas">${opsiKelas(S.lapKelas)}</select></label>
        <div class="tombol">
          <button class="btn tipis" id="lMuat">Muat ulang</button>
          <button class="btn" id="lCsv">${ikon('unduh')}Unduh Excel (CSV)</button>
          <button class="btn emas" id="lCetak">${ikon('cetak')}Cetak</button>
        </div>
      </div>
    </div>
    <div id="lIsi"><p class="muted">Memuat…</p></div>
  </section>`;
  const muat = async paksa => {
    $('#lIsi').innerHTML = `<p class="muted">Memuat…</p>`;
    try { await muatLaporan(S.lapBulan, paksa); renderLaporan(); }
    catch (e) { $('#lIsi').innerHTML = `<p>${esc(pesanError(e))}</p>`; }
  };
  $('#lBulan').onchange = e => { S.lapBulan = e.target.value || tglHariIni().slice(0, 7); muat(false); };
  $('#lKelas').onchange = e => { S.lapKelas = e.target.value; renderLaporan(); };
  $('#lMuat').onclick = () => muat(true);
  $('#lCetak').onclick = () => cetak('laporan');
  $('#lCsv').onclick = () => {
    const lap = S.cacheLap[S.lapBulan]; if (!lap) return;
    const rows = [['Kelas', 'NIS', 'Nama', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Persen kehadiran']];
    S.siswa.filter(s => !S.lapKelas || s.kelas === S.lapKelas).forEach(s => {
      const b = hitungBaris(s, lap);
      rows.push([s.kelas, s.nis, s.nama, b.H, b.T, b.I, b.S, b.A, b.persen ?? '']);
    });
    rows.push([], ['Hari efektif', lap.hari.length]);
    unduhCSV(`rekap-presensi-${S.lapBulan}${S.lapKelas ? '-kelas-' + S.lapKelas : ''}.csv`, rows);
  };
  $('#lIsi').onclick = async e => {
    const b = e.target.closest('[data-hapus-hari]'); if (!b) return;
    const t = b.dataset.hapusHari;
    if (!confirm(`Hapus ${fmtTanggal(t)} dari hari efektif? Gunakan ini bila tanggal tersebut sebenarnya hari libur. Catatan presensi di hari itu tidak ikut terhapus.`)) return;
    try { await deleteDoc(doc(db, 'hari', t)); const lap = S.cacheLap[S.lapBulan]; lap.hari = lap.hari.filter(x => x !== t); renderLaporan(); toast('Hari efektif diperbarui.', 'ok'); }
    catch (err) { toast(pesanError(err), 'error'); }
  };
  muat(false);
}

function renderLaporan() {
  const lap = S.cacheLap[S.lapBulan]; if (!lap) return;
  const he = lap.hari.length;
  const list = S.siswa.filter(s => !S.lapKelas || s.kelas === S.lapKelas);
  const grup = {}; list.forEach(s => (grup[s.kelas] ||= []).push(s));
  const kepalaCetak = `<div class="hanya-cetak">${kopCetak('REKAP PRESENSI BULANAN', `${fmtBulan(S.lapBulan)} · ${he} hari efektif${S.lapKelas ? ' · Kelas ' + S.lapKelas : ''}`)}</div>`;
  const info = `<div class="no-print">
    <details class="hari-efektif"><summary>${he} hari efektif di ${esc(fmtBulan(S.lapBulan))}</summary>
      ${he ? `<ul>${lap.hari.map(t => `<li><span>${esc(fmtTanggal(t))}</span>${isKepala() ? `<button class="btn tipis kecil bahaya" data-hapus-hari="${t}">Hapus</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted kecil">Belum ada presensi di bulan ini.</p>'}
    </details></div>`;
  if (!list.length) { $('#lIsi').innerHTML = info + `<div class="kosong-besar"><p>Belum ada data siswa.</p></div>`; return; }
  const tabel = Object.keys(grup).sort(urutTeks).map(k => {
    const tot = { H: 0, T: 0, I: 0, S: 0, A: 0 };
    const rows = grup[k].map((s, i) => {
      const b = hitungBaris(s, lap);
      ['H', 'T', 'I', 'S', 'A'].forEach(x => tot[x] += b[x]);
      return `<tr><td class="n">${i + 1}</td><td class="angka">${esc(s.nis)}</td><td>${esc(s.nama)}</td>
        ${['H', 'T', 'I', 'S', 'A'].map(x => `<td class="n">${b[x]}</td>`).join('')}
        <td class="n">${b.persen === null ? '-' : b.persen + '%'}</td></tr>`;
    }).join('');
    const maks = grup[k].length * he;
    const rata = maks ? Math.round((tot.H + tot.T) / maks * 100) + '%' : '-';
    return `<section class="grup">
      <div class="grup-judul"><h3>Kelas ${esc(k)}</h3><span class="muted kecil">${grup[k].length} siswa, kehadiran ${rata}</span></div>
      <div class="gulir"><table class="tabel">
        <thead><tr><th class="n">No</th><th>NIS</th><th>Nama</th>
          ${['H', 'T', 'I', 'S', 'A'].map(x => `<th class="n st-${x}" title="${STATUS[x]}">${x}</th>`).join('')}<th class="n">Hadir</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td></td><td></td><td>Jumlah</td>${['H', 'T', 'I', 'S', 'A'].map(x => `<td class="n">${tot[x]}</td>`).join('')}<td class="n">${rata}</td></tr></tfoot>
      </table></div></section>`;
  }).join('');
  $('#lIsi').innerHTML = kepalaCetak + info + tabel +
    `<p class="muted kecil keterangan">H Hadir tepat waktu, T Terlambat, I Izin, S Sakit, A Alpa. Alpa dihitung dari hari efektif yang tidak memiliki catatan. Siswa yang baru ditambahkan di tengah bulan ikut dihitung Alpa untuk hari sebelum ia terdaftar, jadi periksa kembali sebelum laporan dicetak. Persen hadir = (H + T) dibagi hari efektif.</p>` +
    `<div class="hanya-cetak">${ttdCetak(tglHariIni())}${kakiCetak()}</div>`;
}

/* ---------- SISWA ---------- */
function viewSiswa(m) {
  m.innerHTML = `<section>
    <h1 class="judul-hal">${ikonJudul('siswa')}Data siswa</h1>
    <div class="alat">
      <label>Kelas<select id="sKelas">${opsiKelas(S.siswaKelas)}</select></label>
      <label>Cari<input type="search" id="sCari" placeholder="Nama atau NIS"></label>
      <div class="tombol">
        <button class="btn utama" id="sTambah">Tambah siswa</button>
        <button class="btn" id="sImpor">Impor dari Excel</button>
        <button class="btn" id="sFoto">Impor foto</button>
        <button class="btn tipis" id="sMuat">Muat ulang</button>
      </div>
    </div>
    <p class="muted kecil" id="sInfo"></p>
    <div id="sDaftar"></div>
  </section>`;
  $('#sKelas').onchange = e => { S.siswaKelas = e.target.value; renderDaftarSiswa(); };
  $('#sCari').oninput = renderDaftarSiswa;
  $('#sTambah').onclick = () => formSiswa(null);
  $('#sImpor').onclick = formImpor;
  $('#sFoto').onclick = formImporFoto;
  $('#sMuat').onclick = e => sibuk(e.target, async () => {
    try { await muatSiswa(true); viewSiswa(m); toast('Data siswa diperbarui.', 'ok'); } catch (err) { toast(pesanError(err), 'error'); }
  }, 'Memuat…');
  $('#sDaftar').onclick = e => {
    const b = e.target.closest('button[data-aksi]'); if (!b) return;
    const s = S.siswaMap.get(b.closest('[data-nis]').dataset.nis);
    if (b.dataset.aksi === 'edit') formSiswa(s); else hapusSiswa(s);
  };
  renderDaftarSiswa();
}

function renderDaftarSiswa() {
  const cari = ($('#sCari')?.value || '').trim().toLowerCase();
  const list = S.siswa.filter(s => (!S.siswaKelas || s.kelas === S.siswaKelas) &&
    (!cari || s.nama.toLowerCase().includes(cari) || s.nis.toLowerCase().includes(cari)));
  const tanpaFoto = S.siswa.filter(s => !s.foto).length;
  $('#sInfo').textContent = `${S.siswa.length} siswa terdaftar di ${daftarKelas().length} kelas.${tanpaFoto ? ` ${tanpaFoto} siswa belum punya foto.` : ''}`;
  if (!S.siswa.length) {
    $('#sDaftar').innerHTML = `<div class="kosong-besar"><p>Belum ada siswa.</p><p class="kecil">Tambahkan satu per satu, atau impor sekaligus dari Excel.</p></div>`;
    return;
  }
  if (!list.length) { $('#sDaftar').innerHTML = `<p class="muted">Tidak ada siswa yang cocok.</p>`; return; }
  const grup = {}; list.forEach(s => (grup[s.kelas] ||= []).push(s));
  $('#sDaftar').innerHTML = Object.keys(grup).sort(urutTeks).map(k => `<section class="grup">
    <div class="grup-judul"><h3>Kelas ${esc(k)}</h3><span class="muted kecil">${grup[k].length} siswa</span></div>
    <ol class="buku">${grup[k].map((s, i) => `<li class="baris" data-nis="${esc(s.nis)}">
      <span class="no">${i + 1}</span>
      <div><span class="nama">${esc(s.nama)}</span><span class="muted kecil">NIS ${esc(s.nis)}${s.foto ? '' : ', belum ada foto'}</span></div>
      <div class="aksi-baris"><button class="btn tipis kecil" data-aksi="edit">Edit</button><button class="btn tipis kecil bahaya" data-aksi="hapus">Hapus</button></div>
    </li>`).join('')}</ol></section>`).join('');
}

function formSiswa(s) {
  const baru = !s;
  const el = bukaModal(`<form id="fSiswa">
    <h2>${baru ? 'Tambah siswa' : 'Edit siswa'}</h2>
    <label>NIS<input name="nis" required maxlength="40" ${baru ? '' : 'readonly'} value="${esc(s?.nis || '')}" inputmode="numeric"></label>
    ${baru ? '' : '<p class="muted kecil" style="margin-top:-.5rem">NIS tidak bisa diubah. Bila NIS salah, hapus siswa ini lalu tambahkan lagi.</p>'}
    <label>Nama lengkap<input name="nama" required maxlength="80" value="${esc(s?.nama || '')}"></label>
    <label>Kelas<input name="kelas" required maxlength="20" list="dlKelas" placeholder="contoh: 7A" value="${esc(s?.kelas || '')}"></label>
    <datalist id="dlKelas">${daftarKelas().map(k => `<option value="${esc(k)}">`).join('')}</datalist>
    <div class="foto-form">
      <div class="foto-pratinjau" id="fsPratinjau">${htmlFoto(null, s?.nama || '?')}</div>
      <div class="foto-aksi"><span class="label-teks">Foto siswa</span>
        <span class="muted kecil">Foto wajah tegak. Dipotong otomatis ke ukuran 4 × 5 dan tampil di kartu serta di hasil scan.</span>
        <div class="tombol"><label class="btn kecil pilih-file">${s?.foto ? 'Ganti foto' : 'Pilih foto'}<input type="file" accept="image/*" id="fsFoto" hidden></label>
          <button type="button" class="btn tipis kecil bahaya" id="fsHapusFoto" ${s?.foto ? '' : 'hidden'}>Hapus foto</button></div></div>
    </div>
    ${baru ? '' : `<label class="cek"><input type="checkbox" name="tokenBaru"> Buat kartu QR baru. Pakai ini bila kartu hilang; kartu lama otomatis tidak berlaku.</label>`}
    <div class="aksi"><button type="button" class="btn tipis" data-tutup>Batal</button>
      <button class="btn utama">${baru ? 'Simpan siswa' : 'Simpan perubahan'}</button></div>
  </form>`);
  let fotoBaru; // undefined = tidak diubah, string = foto baru, null = dihapus
  const pratinjau = url => { $('#fsPratinjau', el).innerHTML = htmlFoto(url, $('[name=nama]', el).value || s?.nama || '?'); };
  if (s?.foto) ambilFoto(s).then(u => { if (fotoBaru === undefined && u) pratinjau(u); });
  $('#fsFoto', el).onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try { fotoBaru = await kecilkanFoto(file); pratinjau(fotoBaru); $('#fsHapusFoto', el).hidden = false; }
    catch (err) { toast(err.message, 'error'); }
  };
  $('#fsHapusFoto', el).onclick = () => { fotoBaru = null; pratinjau(null); $('#fsHapusFoto', el).hidden = true; };
  $('#fSiswa', el).onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const nis = f.get('nis').trim(), nama = f.get('nama').trim().replace(/\s+/g, ' '), kelas = f.get('kelas').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!NIS_VALID.test(nis)) return toast('NIS hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.', 'error');
    if (baru && S.siswaMap.has(nis)) return toast(`NIS ${nis} sudah dipakai oleh ${S.siswaMap.get(nis).nama}.`, 'error');
    const token = baru || f.get('tokenBaru') ? acak() : s.token;
    await sibuk($('#fSiswa .utama'), async () => {
      try {
        const b = writeBatch(db);
        let foto = s?.foto;
        if (fotoBaru) foto = tulisFoto(b, nis, fotoBaru);
        else if (fotoBaru === null) { foto = undefined; b.delete(doc(db, 'foto', nis)); cacheFoto.delete(nis); }
        const d = { nis, nama, kelas, token, ...(foto ? { foto } : {}) };
        b.set(doc(db, 'siswa', nis), { ...d, diubah: serverTimestamp(), diubahOleh: S.profil.nama });
        const v = naikkanVersi(b);
        await b.commit();
        const data = S.siswa.filter(x => x.nis !== nis); data.push(d);
        setSiswa(data); simpanCacheSiswa(v);
        tutupModal(); renderTab();
        toast(baru ? `${nama} ditambahkan.` : `Data ${nama} disimpan.${token !== s?.token ? ' Cetak ulang kartunya di menu Kartu QR.' : ''}`, 'ok');
      } catch (err) { toast(pesanError(err), 'error'); }
    });
  };
}

async function hapusSiswa(s) {
  if (!confirm(`Hapus ${s.nama} (NIS ${s.nis}, kelas ${s.kelas})? Siswa ini tidak akan muncul lagi di daftar presensi dan laporan.`)) return;
  try {
    const b = writeBatch(db);
    b.delete(doc(db, 'siswa', s.nis));
    if (s.foto) b.delete(doc(db, 'foto', s.nis));
    const v = naikkanVersi(b);
    await b.commit();
    setSiswa(S.siswa.filter(x => x.nis !== s.nis)); simpanCacheSiswa(v);
    renderDaftarSiswa(); toast(`${s.nama} dihapus.`, 'ok');
  } catch (err) { toast(pesanError(err), 'error'); }
}

function parseImpor(teks) {
  const hasil = [], salah = [];
  teks.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const p = line.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    if (p.length < 3) { salah.push(i + 1); return; }
    const nis = p[0], kelas = p[p.length - 1].toUpperCase().replace(/\s+/g, ' ');
    const nama = p.slice(1, -1).join(sep === ',' ? ', ' : ' ').replace(/\s+/g, ' ').trim();
    if (i === 0 && /^nis$/i.test(nis)) return;
    if (!NIS_VALID.test(nis) || !nama || !kelas) { salah.push(i + 1); return; }
    hasil.push({ nis, nama, kelas });
  });
  const unik = new Map(hasil.map(s => [s.nis, s]));
  return { data: [...unik.values()], salah };
}

function formImpor() {
  const el = bukaModal(`<form id="fImpor">
    <h2>Impor siswa dari Excel</h2>
    <div class="kotak-info">Siapkan tiga kolom berurutan: <b>NIS</b>, <b>Nama</b>, <b>Kelas</b>. Blok datanya di Excel, salin, lalu tempel di bawah. Bisa juga memilih file CSV. NIS yang sudah ada akan diperbarui nama dan kelasnya, kartunya tetap berlaku.</div>
    <label>Pilih file CSV<input type="file" accept=".csv,.txt,text/csv" id="iFile"></label>
    <label>Atau tempel data<textarea id="iTeks" placeholder="1001	Ahmad Fauzi	7A&#10;1002	Siti Aminah	7A"></textarea></label>
    <p class="muted kecil" id="iInfo">Belum ada data.</p>
    <div class="aksi"><button type="button" class="btn tipis" data-tutup>Batal</button>
      <button class="btn utama" disabled>Impor siswa</button></div>
  </form>`);
  let parsed = { data: [], salah: [] };
  const tombol = $('.utama', el);
  const periksa = () => {
    parsed = parseImpor($('#iTeks', el).value);
    const baru = parsed.data.filter(s => !S.siswaMap.has(s.nis)).length;
    $('#iInfo', el).textContent = parsed.data.length
      ? `${parsed.data.length} siswa terbaca: ${baru} baru, ${parsed.data.length - baru} diperbarui.${parsed.salah.length ? ` Baris ${parsed.salah.slice(0, 8).join(', ')}${parsed.salah.length > 8 ? '…' : ''} dilewati karena formatnya tidak sesuai.` : ''}`
      : 'Belum ada data yang terbaca.';
    tombol.disabled = !parsed.data.length;
  };
  $('#iTeks', el).oninput = periksa;
  $('#iFile', el).onchange = async e => { const f = e.target.files[0]; if (f) { $('#iTeks', el).value = await f.text(); periksa(); } };
  $('#fImpor', el).onsubmit = async e => {
    e.preventDefault();
    await sibuk(tombol, async () => {
      try {
        const semua = new Map(S.siswa.map(s => [s.nis, s]));
        let v;
        for (let i = 0; i < parsed.data.length; i += 400) {
          const b = writeBatch(db);
          parsed.data.slice(i, i + 400).forEach(s => {
            const lama = S.siswaMap.get(s.nis);
            const d = { ...s, token: lama?.token || acak(), ...(lama?.foto ? { foto: lama.foto } : {}) };
            b.set(doc(db, 'siswa', s.nis), { ...d, diubah: serverTimestamp(), diubahOleh: S.profil.nama });
            semua.set(s.nis, d);
          });
          v = naikkanVersi(b);
          await b.commit();
        }
        setSiswa([...semua.values()]); simpanCacheSiswa(v);
        tutupModal(); renderTab();
        toast(`${parsed.data.length} siswa berhasil diimpor.`, 'ok');
      } catch (err) { toast(pesanError(err), 'error'); }
    }, 'Mengimpor…');
  };
}

// Impor banyak foto sekaligus: nama file = NIS (contoh 1001.jpg).
function formImporFoto() {
  const el = bukaModal(`<form id="fImporFoto">
    <h2>Impor foto siswa</h2>
    <div class="kotak-info">Beri nama setiap file foto dengan <b>NIS</b> siswa, misalnya <b>1001.jpg</b>, lalu pilih semua file sekaligus. Foto dipotong otomatis ke ukuran 4 × 5. Foto lama milik siswa yang sama akan diganti.</div>
    <label>Pilih file foto<input type="file" accept="image/*" multiple id="ifFile"></label>
    <p class="muted kecil" id="ifInfo">Belum ada file dipilih.</p>
    <div class="aksi"><button type="button" class="btn tipis" data-tutup>Batal</button>
      <button class="btn utama" disabled>Impor foto</button></div>
  </form>`);
  const tombol = $('.utama', el);
  let cocok = [];
  $('#ifFile', el).onchange = e => {
    const files = [...e.target.files];
    cocok = []; const asing = [];
    files.forEach(f => { const nis = f.name.replace(/\.[^.]+$/, '').trim(); S.siswaMap.has(nis) ? cocok.push([nis, f]) : asing.push(f.name); });
    $('#ifInfo', el).textContent = files.length
      ? `${cocok.length} foto cocok dengan NIS siswa.${asing.length ? ` ${asing.length} file dilewati karena namanya bukan NIS yang terdaftar: ${asing.slice(0, 5).join(', ')}${asing.length > 5 ? '…' : ''}.` : ''}`
      : 'Belum ada file dipilih.';
    tombol.disabled = !cocok.length;
  };
  $('#fImporFoto', el).onsubmit = async e => {
    e.preventDefault();
    await sibuk(tombol, async () => {
      let ok = 0; const gagal = [];
      try {
        for (let i = 0; i < cocok.length; i += 40) {
          const b = writeBatch(db); const ubah = [];
          for (const [nis, file] of cocok.slice(i, i + 40)) {
            $('#ifInfo', el).textContent = `Memproses foto ${ok + gagal.length + 1} dari ${cocok.length}…`;
            try {
              const data = await kecilkanFoto(file);
              const foto = tulisFoto(b, nis, data);
              b.set(doc(db, 'siswa', nis), { foto, diubah: serverTimestamp(), diubahOleh: S.profil.nama }, { merge: true });
              ubah.push([nis, foto]);
            } catch { gagal.push(file.name); }
          }
          if (!ubah.length) continue;
          const v = naikkanVersi(b);
          await b.commit();
          setSiswa(S.siswa.map(s => { const u = ubah.find(x => x[0] === s.nis); return u ? { ...s, foto: u[1] } : s; }));
          simpanCacheSiswa(v); ok += ubah.length;
        }
        tutupModal(); renderTab();
        toast(`${ok} foto berhasil diimpor.${gagal.length ? ` ${gagal.length} file tidak bisa dibuka: ${gagal.slice(0, 3).join(', ')}.` : ''}`, gagal.length ? 'info' : 'ok');
      } catch (err) { toast(pesanError(err), 'error'); }
    }, 'Mengimpor…');
  };
}

/* ---------- KARTU QR ---------- */
function svgQR(teks) {
  const qr = qrcode(0, 'M'); qr.addData(teks); qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
function viewKartu(m) {
  if (!S.kartuKelas && daftarKelas().length) S.kartuKelas = daftarKelas()[0];
  S.kartuBentuk ||= ambilLokal('bentukKartu') === 'lanskap' ? 'lanskap' : 'potret';
  m.innerHTML = `<section>
    <div class="no-print">
      <h1 class="judul-hal">${ikonJudul('kartu')}Kartu QR siswa</h1>
      <p class="muted kecil" id="kUkuran"></p>
      <div class="alat">
        <label>Kelas<select id="kKelas">${opsiKelas(S.kartuKelas)}</select></label>
        <label>Bentuk kartu<select id="kBentuk">
          <option value="potret" ${S.kartuBentuk === 'potret' ? 'selected' : ''}>Potret (tegak)</option>
          <option value="lanskap" ${S.kartuBentuk === 'lanskap' ? 'selected' : ''}>Lanskap (mendatar)</option></select></label>
        <div class="tombol"><button class="btn emas" id="kCetak">${ikon('cetak')}Cetak kartu</button></div>
      </div>
      <p class="muted kecil" id="kInfo"></p>
    </div>
    <div id="kDaftar" class="kartu-grid"></div>
  </section>`;
  $('#kKelas').onchange = e => { S.kartuKelas = e.target.value; isiKartu(); };
  $('#kBentuk').onchange = e => { S.kartuBentuk = e.target.value; simpanLokal('bentukKartu', S.kartuBentuk); isiKartu(); };
  $('#kCetak').onclick = () => cetak('kartu');
  isiKartu();
}
function isiKartu() {
  const box = $('#kDaftar');
  box.className = 'kartu-grid bentuk-' + S.kartuBentuk;
  $('#kUkuran').textContent = (S.kartuBentuk === 'potret'
    ? 'Kartu tegak 5,4 × 8,6 cm (ukuran KTP), 9 kartu per kertas A4.'
    : 'Kartu mendatar 8,6 × 5,4 cm (ukuran KTP), 10 kartu per kertas A4.')
    + ' Saat mencetak, pilih skala 100% (bukan “sesuaikan halaman”), gunting tepat di tepi luar bingkai warna, lalu laminasi.';
  if (!window.qrcode) { box.innerHTML = `<p>Komponen pembuat QR gagal dimuat. Periksa koneksi lalu muat ulang halaman.</p>`; return; }
  const list = S.siswa.filter(s => !S.kartuKelas || s.kelas === S.kartuKelas);
  if (!list.length) { box.innerHTML = `<div class="kosong-besar"><p>Belum ada siswa untuk dibuatkan kartu.</p></div>`; return; }
  box.innerHTML = list.map(s => `<article class="kartu-qr" style="--logo:url('${LOGO_LATAR_URL}')">
    <div class="kq-siluet" aria-hidden="true"></div>
    <div class="kq-band"><img class="kq-logo" src="${LOGO_URL}" alt=""><div class="kq-band-teks">
      <p class="kq-sekolah">${esc(S.namaSekolah)}</p><p class="kq-jenis">Kartu Presensi Siswa</p></div></div>
    <div class="kq-foto" data-nis="${esc(s.nis)}">${htmlFoto(null, s.nama)}</div>
    <div class="kq-teks"><p class="kq-nama">${esc(s.nama)}</p><p class="kq-label"><span class="kq-kelas">Kelas ${esc(s.kelas)}</span><span class="kq-nis">NIS ${esc(s.nis)}</span></p></div>
    <div class="kq-qr"><span class="kq-qr-kotak">${svgQR(`ABSEN:${s.nis}:${s.token}`)}</span><span class="kq-qr-label">Scan untuk presensi</span></div>
    <div class="kq-garis">${esc(MOTTO)}</div>
  </article>`).join('');
  // Foto dimuat setelah kartu tampil; tombol cetak menunggu sampai semua foto siap.
  const berfoto = list.filter(s => s.foto);
  const info = $('#kInfo'), btn = $('#kCetak');
  const tanpa = list.length - berfoto.length;
  const catatan = tanpa ? ` ${tanpa} siswa belum punya foto; kartunya memakai inisial nama.` : '';
  if (!berfoto.length) { info.textContent = catatan.trim(); btn.disabled = false; return; }
  let selesai = 0; btn.disabled = true;
  info.textContent = `Memuat foto 0 dari ${berfoto.length}…`;
  const kelasIni = S.kartuKelas;
  berfoto.forEach(s => ambilFoto(s).then(url => {
    if (S.kartuKelas !== kelasIni || !document.body.contains(box)) return;
    const el = box.querySelector(`.kq-foto[data-nis="${CSS.escape(s.nis)}"]`);
    if (el && url) el.innerHTML = htmlFoto(url, s.nama);
    selesai++;
    info.textContent = selesai < berfoto.length ? `Memuat foto ${selesai} dari ${berfoto.length}…` : `Semua foto siap dicetak.${catatan}`;
    if (selesai === berfoto.length) btn.disabled = false;
  }));
}

/* ---------- GURU (khusus kepala sekolah) ---------- */
async function buatAkunGuru(email, pw) {
  // Aplikasi Firebase kedua supaya kepala sekolah tidak ikut keluar saat akun baru dibuat.
  const sek = initializeApp(firebaseConfig, 'sekunder-' + Date.now());
  try {
    const a = pakaiEmulator(getAuth(sek));
    const c = await createUserWithEmailAndPassword(a, email, pw);
    await signOut(a);
    return c.user.uid;
  } finally { await deleteApp(sek); }
}

async function viewGuru(m) {
  if (!isKepala()) return viewScan(m);
  m.innerHTML = `<section>
    <h1 class="judul-hal">${ikonJudul('guru')}Akun guru</h1>
    <p class="muted kecil">Semua guru aktif bisa melakukan scan untuk seluruh siswa, mengelola data siswa, dan melihat laporan.</p>
    <div class="alat"><div class="tombol"><button class="btn utama" id="gTambah">Tambah guru</button></div></div>
    <div id="gDaftar"><p class="muted">Memuat…</p></div>
  </section>`;
  $('#gTambah').onclick = formGuru;
  $('#gDaftar').onclick = async e => {
    const b = e.target.closest('button[data-aksi]'); if (!b) return;
    const li = b.closest('[data-uid]'); const uid = li.dataset.uid, nama = li.dataset.nama, email = li.dataset.email;
    try {
      if (b.dataset.aksi === 'aktif') {
        const aktif = b.dataset.nilai === '1';
        await updateDoc(doc(db, 'users', uid), { aktif });
        toast(aktif ? `${nama} diaktifkan.` : `${nama} dinonaktifkan dan tidak bisa masuk lagi.`, 'ok');
      } else if (b.dataset.aksi === 'reset') {
        await sendPasswordResetEmail(auth, email);
        toast(`Tautan atur ulang kata sandi dikirim ke ${email}.`, 'ok'); return;
      } else if (b.dataset.aksi === 'hapus') {
        if (!confirm(`Hapus akses ${nama}? Untuk menghapus akun loginnya sepenuhnya, hapus juga email ${email} di Firebase Console → Authentication.`)) return;
        await deleteDoc(doc(db, 'users', uid));
        toast(`Akses ${nama} dihapus.`, 'ok');
      }
      muatGuru();
    } catch (err) { toast(pesanError(err), 'error'); }
  };
  muatGuru();
}
async function muatGuru() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.role === 'kepala' ? -1 : 0) - (b.role === 'kepala' ? -1 : 0) || urutTeks(a.nama, b.nama));
    $('#gDaftar').innerHTML = `<ol class="buku">${list.map((u, i) => `<li class="baris" data-uid="${esc(u.uid)}" data-nama="${esc(u.nama)}" data-email="${esc(u.email)}">
      <span class="no">${i + 1}</span>
      <div><span class="nama">${esc(u.nama)}</span>
        <span class="muted kecil">${esc(u.email)}, ${u.role === 'kepala' ? 'Kepala Sekolah' : 'Guru'}${u.aktif ? '' : ', nonaktif'}</span></div>
      ${u.role === 'guru' ? `<div class="aksi-baris">
        <button class="btn tipis kecil" data-aksi="reset">Reset sandi</button>
        <button class="btn tipis kecil" data-aksi="aktif" data-nilai="${u.aktif ? 0 : 1}">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button class="btn tipis kecil bahaya" data-aksi="hapus">Hapus</button></div>` : '<span></span>'}
    </li>`).join('')}</ol>`;
  } catch (e) { $('#gDaftar').innerHTML = `<p>${esc(pesanError(e))}</p>`; }
}

function formGuru() {
  const el = bukaModal(`<form id="fGuru">
    <h2>Tambah guru</h2>
    <label>Nama guru<input name="nama" required maxlength="80"></label>
    <label>Email<input name="email" type="email" required></label>
    <label>Kata sandi awal<input name="pw" required minlength="6" value="${acak(8)}"></label>
    <p class="muted kecil">Berikan email dan kata sandi ini kepada guru. Guru bisa menggantinya lewat tombol Lupa kata sandi di halaman masuk.</p>
    <div class="aksi"><button type="button" class="btn tipis" data-tutup>Batal</button><button class="btn utama">Buat akun guru</button></div>
  </form>`);
  $('#fGuru', el).onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const nama = f.get('nama').trim(), email = f.get('email').trim().toLowerCase(), pw = f.get('pw');
    await sibuk($('.utama', el), async () => {
      try {
        const uid = await buatAkunGuru(email, pw);
        await setDoc(doc(db, 'users', uid), { nama, email, role: 'guru', aktif: true, dibuat: serverTimestamp(), dibuatOleh: S.profil.nama });
        bukaModal(`<div class="isi"><h2>Akun guru dibuat</h2>
          <div class="kotak-info">Nama: <b>${esc(nama)}</b><br>Email: <b>${esc(email)}</b><br>Kata sandi: <b class="angka">${esc(pw)}</b></div>
          <p class="muted kecil">Catat atau kirimkan data ini ke guru yang bersangkutan sekarang. Kata sandi tidak ditampilkan lagi setelah jendela ini ditutup.</p>
          <div class="aksi"><button class="btn utama" data-tutup>Selesai</button></div></div>`);
        muatGuru();
      } catch (err) { toast(pesanError(err), 'error'); }
    }, 'Membuat akun…');
  };
}

/* ---------- PENGATURAN (khusus kepala sekolah) ---------- */
function viewPengaturan(m) {
  if (!isKepala()) return viewScan(m);
  m.innerHTML = `<section style="max-width:520px">
    <h1 class="judul-hal">${ikonJudul('pengaturan')}Pengaturan sekolah</h1>
    <form id="fAtur" style="display:grid;gap:1rem;margin-top:1rem">
      <label>Nama sekolah<input name="sekolah" required value="${esc(S.namaSekolah)}"></label>
      <label>Jam masuk<input name="jam" type="time" required value="${esc(S.pengaturan.jamMasuk)}"></label>
      <p class="muted kecil" style="margin-top:-.5rem">Scan setelah jam ini dicatat Terlambat.</p>
      <div><button class="btn utama">Simpan pengaturan</button></div>
    </form>
    <div class="kotak-info" style="margin-top:1.5rem">
      <p><b>Pemakaian kuota gratis</b></p>
      <p class="kecil">Pantau di Firebase Console → Firestore Database → Usage. Kuota harian direset sekitar pukul 14.00–15.00 WIB. Untuk 300 siswa, pemakaian normal hanya sebagian kecil dari kuota.</p>
    </div>
  </section>`;
  $('#fAtur').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const nama = f.get('sekolah').trim(), jam = f.get('jam');
    await sibuk($('#fAtur .utama'), async () => {
      try {
        await Promise.all([
          updateDoc(doc(db, 'config', 'setup'), { namaSekolah: nama }),
          setDoc(doc(db, 'config', 'pengaturan'), { jamMasuk: jam }, { merge: true })
        ]);
        S.namaSekolah = nama; S.pengaturan.jamMasuk = jam;
        $('.sekolah').textContent = nama;
        toast('Pengaturan disimpan.', 'ok');
      } catch (err) { toast(pesanError(err), 'error'); }
    });
  };
}

/* ---------- mulai ---------- */
if (belumDiisi) {
  renderBelumDiisi();
} else {
  onAuthStateChanged(auth, async u => {
    if (S.sedangSetup) return;
    if (!u) {
      await hentikanKamera();
      Object.assign(S, { profil: null, cacheHarian: {}, cacheLap: {}, riwayat: [], tab: 'scan' });
      renderMuat();
      try {
        const s = await getDoc(doc(db, 'config', 'setup'));
        if (s.exists()) S.namaSekolah = s.data().namaSekolah || S.namaSekolah;
        renderLogin(!s.exists());
      } catch (e) { renderLogin(false); toast(pesanError(e), 'error'); }
      return;
    }
    masuk(u);
  });
}
