// Edge Function: membuat akun login + profil.
//   - Pembina menambah siswa (selalu masuk ke Gudep pembina itu).
//   - Mabigus menambah pembina (Gudep dipilih).
// Pasang: supabase functions deploy buat-akun
// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis di Edge Function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMAIN_EMAIL = '@sdn3boloh.sch.id'; // samakan dengan config.js
const GUDEP = ['05.093', '05.122'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.trim().slice(0, maks) : '') || null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // Pastikan pemanggil sedang login dan perannya cocok
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: galatUser } = await admin.auth.getUser(token);
    if (galatUser || !user) return json({ error: 'Sesi berakhir. Silakan masuk lagi.' }, 401);
    const { data: pemanggil } = await admin.from('profil_pengguna').select('role,gudep,aktif').eq('id', user.id).single();
    if (!pemanggil || pemanggil.aktif === false) return json({ error: 'Akun Anda tidak aktif.' }, 403);

    const b = await req.json();
    const role = b.role === 'pembina' ? 'pembina' : 'siswa';
    if (role === 'siswa' && pemanggil.role !== 'pembina') return json({ error: 'Hanya pembina yang boleh menambah siswa.' }, 403);
    if (role === 'pembina' && pemanggil.role !== 'mabigus') return json({ error: 'Hanya mabigus yang boleh menambah pembina.' }, 403);

    const nomor = String(b.nis ?? '').trim();
    const nama = teks(b.nama, 80);
    const gudep = role === 'siswa' ? pemanggil.gudep : b.gudep;
    if (!/^\d{1,20}$/.test(nomor)) return json({ error: (role === 'siswa' ? 'NIS' : 'NIP') + ' harus berupa angka.' }, 400);
    if (!nama) return json({ error: 'Nama wajib diisi.' }, 400);
    if (!GUDEP.includes(gudep)) return json({ error: 'Pilih Gudep yang benar.' }, 400);
    if (typeof b.kata_sandi !== 'string' || b.kata_sandi.length < 6)
      return json({ error: 'Kata sandi minimal 6 karakter.' }, 400);

    const { data: baru, error: galatAkun } = await admin.auth.admin.createUser({
      email: nomor + DOMAIN_EMAIL, password: b.kata_sandi, email_confirm: true,
    });
    if (galatAkun || !baru.user)
      return json({ error: /already|registered|exists/i.test(galatAkun?.message ?? '') ? 'Nomor ini sudah punya akun.' : galatAkun?.message }, 400);

    const profil = role === 'siswa'
      ? { tingkat: ['mula', 'bantu', 'tata', 'ramu'].includes(b.tingkat) ? b.tingkat : 'mula',
          kelas: teks(b.kelas, 5), barung: teks(b.barung, 20), hp_ortu: teks(b.hp_ortu, 16) }
      : { no_hp: teks(b.no_hp, 16) };
    const { error: galatProfil } = await admin.from('profil_pengguna').upsert({
      id: baru.user.id, nis_nip: nomor, nama, role, gudep, aktif: true, ...profil,
    });
    if (galatProfil) {
      await admin.auth.admin.deleteUser(baru.user.id); // jangan tinggalkan akun tanpa profil
      return json({ error: 'Gagal menyimpan profil: ' + galatProfil.message }, 400);
    }
    return json({ id: baru.user.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
