// Edge Function: pembina menambah siswa baru (akun login + profil).
// Pasang: supabase functions deploy buat-siswa
// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis di Edge Function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMAIN_EMAIL = '@sdn3boloh.sch.id'; // samakan dengan config.js
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

    // Pastikan pemanggil adalah pembina yang sedang login
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: galatUser } = await admin.auth.getUser(token);
    if (galatUser || !user) return json({ error: 'Sesi berakhir. Silakan masuk lagi.' }, 401);
    const { data: pemanggil } = await admin.from('profil_pengguna').select('role,gudep').eq('id', user.id).single();
    if (pemanggil?.role !== 'pembina') return json({ error: 'Hanya pembina yang boleh menambah siswa.' }, 403);

    const b = await req.json();
    const nis = String(b.nis ?? '').trim();
    const nama = teks(b.nama, 80);
    const tingkat = ['mula', 'bantu', 'tata'].includes(b.tingkat) ? b.tingkat : 'mula';
    if (!/^\d{1,20}$/.test(nis)) return json({ error: 'NIS harus berupa angka.' }, 400);
    if (!nama) return json({ error: 'Nama wajib diisi.' }, 400);
    if (typeof b.kata_sandi !== 'string' || b.kata_sandi.length < 6)
      return json({ error: 'Kata sandi minimal 6 karakter.' }, 400);

    const { data: baru, error: galatAkun } = await admin.auth.admin.createUser({
      email: nis + DOMAIN_EMAIL, password: b.kata_sandi, email_confirm: true,
    });
    if (galatAkun || !baru.user)
      return json({ error: /already|registered|exists/i.test(galatAkun?.message ?? '') ? 'NIS ini sudah punya akun.' : galatAkun?.message }, 400);

    // Siswa selalu masuk ke Gudep pembina yang menambahkannya
    const { error: galatProfil } = await admin.from('profil_pengguna').upsert({
      id: baru.user.id, nis_nip: nis, nama, role: 'siswa', gudep: pemanggil.gudep, tingkat,
      kelas: teks(b.kelas, 5), barung: teks(b.barung, 20), hp_ortu: teks(b.hp_ortu, 16), aktif: true,
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
