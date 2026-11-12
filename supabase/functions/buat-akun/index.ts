// Edge Function: kelola akun login (membutuhkan service_role, jadi dijalankan di server).
//   aksi "buat"        : pembina menambah siswa (Gudep pembina itu); mabigus menambah pembina
//   aksi "massal"      : pembina mengimpor banyak siswa sekaligus (maks. 50 per panggilan)
//   aksi "ubah_nomor"  : ganti NIS/NIP (alamat login) siswa/pembina
//   aksi "ubah_sandi"  : atur ulang kata sandi
//   aksi "hapus"       : hapus akun beserta datanya
// Pembina hanya boleh mengelola siswa di Gudep-nya; mabigus boleh mengelola pembina dan siswa.
// Pasang/perbarui: Edge Functions > buat-akun > tempel kode ini > Deploy
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMAIN_EMAIL = '@sdn3boloh.sch.id'; // samakan dengan config.js
const GUDEP = ['05.093', '05.122'];
const TINGKAT = ['mula', 'bantu', 'tata', 'ramu'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
// "versi" memberi tahu aplikasi bahwa fungsi ini sudah versi baru (mendukung impor, ubah, hapus)
const VERSI = 2;
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ ...body, versi: VERSI }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.trim().slice(0, maks) : '') || null;
const nomorValid = (n: string) => /^\d{1,20}$/.test(n);
const sandiValid = (s: unknown) => typeof s === 'string' && s.length >= 6;

type Profil = { id: string; role: string; gudep: string | null; aktif: boolean | null };
class Galat extends Error { constructor(msg: string, public status = 400) { super(msg); } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // Pemanggil harus login dan aktif
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: galatUser } = await admin.auth.getUser(token);
    if (galatUser || !user) return json({ error: 'Sesi berakhir. Silakan masuk lagi.' }, 401);
    const { data: saya } = await admin.from('profil_pengguna').select('id,role,gudep,aktif').eq('id', user.id).single<Profil>();
    if (!saya || saya.aktif === false) return json({ error: 'Akun Anda tidak aktif.' }, 403);

    const b = await req.json();
    const aksi = typeof b.aksi === 'string' ? b.aksi : 'buat';

    // ---------- membuat satu akun ----------
    async function buatSatu(d: Record<string, unknown>, role: 'siswa' | 'pembina') {
      if (role === 'siswa' && saya!.role !== 'pembina') throw new Galat('Hanya pembina yang boleh menambah siswa.', 403);
      if (role === 'pembina' && saya!.role !== 'mabigus') throw new Galat('Hanya mabigus yang boleh menambah pembina.', 403);
      const nomor = String(d.nis ?? '').trim();
      const nama = teks(d.nama, 80);
      const gudep = role === 'siswa' ? saya!.gudep : d.gudep;
      if (!nomorValid(nomor)) throw new Galat((role === 'siswa' ? 'NIS' : 'NIP') + ' harus berupa angka.');
      if (!nama) throw new Galat('Nama wajib diisi.');
      if (!GUDEP.includes(gudep as string)) throw new Galat('Pilih Gudep yang benar.');
      if (!sandiValid(d.kata_sandi)) throw new Galat('Kata sandi minimal 6 karakter.');

      const { data: baru, error: galatAkun } = await admin.auth.admin.createUser({
        email: nomor + DOMAIN_EMAIL, password: d.kata_sandi as string, email_confirm: true,
      });
      if (galatAkun || !baru.user)
        throw new Galat(/already|registered|exists/i.test(galatAkun?.message ?? '') ? 'Nomor ini sudah punya akun.' : (galatAkun?.message ?? 'Gagal membuat akun.'));

      const profil = role === 'siswa'
        ? { tingkat: TINGKAT.includes(d.tingkat as string) ? d.tingkat : 'mula',
            kelas: teks(d.kelas, 5), barung: teks(d.barung, 20), hp_ortu: teks(d.hp_ortu, 16) }
        : { no_hp: teks(d.no_hp, 16) };
      const { error: galatProfil } = await admin.from('profil_pengguna').upsert({
        id: baru.user.id, nis_nip: nomor, nama, role, gudep, aktif: true, ...profil,
      });
      if (galatProfil) {
        await admin.auth.admin.deleteUser(baru.user.id); // jangan tinggalkan akun tanpa profil
        throw new Galat('Gagal menyimpan profil: ' + galatProfil.message);
      }
      return baru.user.id;
    }

    // ---------- akun yang boleh dikelola pemanggil ----------
    async function sasaran(id: unknown): Promise<Profil> {
      if (typeof id !== 'string' || !id) throw new Galat('Akun tidak ditemukan.', 404);
      if (id === saya!.id) throw new Galat('Akun Anda sendiri tidak bisa dikelola dari sini.', 403);
      const { data: t } = await admin.from('profil_pengguna').select('id,role,gudep,aktif').eq('id', id).single<Profil>();
      if (!t) throw new Galat('Akun tidak ditemukan.', 404);
      const boleh = (saya!.role === 'pembina' && t.role === 'siswa' && t.gudep === saya!.gudep)
                 || (saya!.role === 'mabigus' && (t.role === 'pembina' || t.role === 'siswa'));
      if (!boleh) throw new Galat('Anda tidak berhak mengelola akun ini.', 403);
      return t;
    }

    if (aksi === 'buat') {
      return json({ id: await buatSatu(b, b.role === 'pembina' ? 'pembina' : 'siswa') });
    }

    if (aksi === 'massal') {
      if (saya.role !== 'pembina') return json({ error: 'Hanya pembina yang boleh mengimpor siswa.' }, 403);
      if (!Array.isArray(b.daftar) || b.daftar.length === 0) return json({ error: 'Daftar siswa kosong.' }, 400);
      if (b.daftar.length > 50) return json({ error: 'Maksimal 50 siswa per pengiriman.' }, 400);
      const hasil = [];
      for (const d of b.daftar) {
        try { hasil.push({ nis: d.nis, ok: true, id: await buatSatu(d, 'siswa') }); }
        catch (e) { hasil.push({ nis: d.nis, ok: false, error: (e as Error).message }); }
      }
      return json({ hasil });
    }

    if (aksi === 'ubah_nomor') {
      const t = await sasaran(b.id);
      const nomor = String(b.nis ?? '').trim();
      if (!nomorValid(nomor)) return json({ error: 'Nomor harus berupa angka.' }, 400);
      const { data: ada } = await admin.from('profil_pengguna').select('id').eq('nis_nip', nomor).neq('id', t.id).maybeSingle();
      if (ada) return json({ error: 'Nomor ini sudah dipakai akun lain.' }, 400);
      const { error: e1 } = await admin.auth.admin.updateUserById(t.id, { email: nomor + DOMAIN_EMAIL, email_confirm: true });
      if (e1) return json({ error: /already|exists|registered/i.test(e1.message) ? 'Nomor ini sudah dipakai akun lain.' : e1.message }, 400);
      const { error: e2 } = await admin.from('profil_pengguna').update({ nis_nip: nomor }).eq('id', t.id);
      if (e2) return json({ error: 'Gagal menyimpan nomor: ' + e2.message }, 400);
      return json({ ok: true });
    }

    if (aksi === 'ubah_sandi') {
      const t = await sasaran(b.id);
      if (!sandiValid(b.kata_sandi)) return json({ error: 'Kata sandi minimal 6 karakter.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(t.id, { password: b.kata_sandi });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (aksi === 'hapus') {
      const t = await sasaran(b.id);
      // Hapus data yang terkait dulu (tabel versi lama mungkin tidak punya "on delete cascade")
      for (const tabel of ['absensi_mingguan', 'iuran_bulanan', 'pencapaian_sku', 'pengajuan_pelantikan']) {
        const { error } = await admin.from(tabel).delete().eq('siswa_id', t.id);
        if (error && !/does not exist|could not find/i.test(error.message)) return json({ error: `Gagal menghapus data ${tabel}: ${error.message}` }, 400);
      }
      const { error: e1 } = await admin.from('profil_pengguna').delete().eq('id', t.id);
      if (e1) return json({ error: 'Gagal menghapus profil: ' + e1.message }, 400);
      const { error: e2 } = await admin.auth.admin.deleteUser(t.id);
      if (e2 && !/not.?found/i.test(e2.message)) return json({ error: 'Profil terhapus, tetapi akun login gagal dihapus: ' + e2.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400);
  } catch (e) {
    if (e instanceof Galat) return json({ error: e.message }, e.status);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
