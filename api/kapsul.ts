// /api/kapsul — Kapsul Waktu: Dilla & Farid saling menulis, baru bisa dibaca saat ulang tahun ke-22.
// Kuncinya di SERVER: sebelum waktunya, isi tulisan pihak lain tidak pernah dikirim ke browser.
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, safeEqual, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'

const UMUR_KAPSUL = 22
const MAX_LEN = 6000
const key = (r: Role) => `kapsul:${r}`

/** 00:00 WIB (UTC+7) di hari ulang tahun ke-`umur`. */
const ultahWIB = (umur: number) => Date.UTC(config.lahir.tahun + umur, config.lahir.bulan - 1, config.lahir.tanggal) - 7 * 3600_000

function bukaPada() {
  const o = process.env.KAPSUL_BUKA // hanya untuk uji, mis. 2026-01-01T00:00:00+07:00
  const t = o ? Date.parse(o) : NaN
  return Number.isFinite(t) ? t : ultahWIB(UMUR_KAPSUL)
}

type Isi = { teks: string; diubah: number }
async function isi(r: Role): Promise<Isi | null> {
  const raw = await kv().get(key(r))
  try {
    return raw ? (JSON.parse(raw) as Isi) : null
  } catch {
    return null
  }
}

// Dipanggil Vercel Cron tiap 13 Nov 00:00 WIB (lihat vercel.json): ucapan ultah + kabar kapsul terbuka.
async function cron(req: Request) {
  const s = process.env.CRON_SECRET
  const h = req.headers.get('authorization') || ''
  if (!s || !safeEqual(h, `Bearer ${s}`)) throw new HttpError(401, 'unauthorized')
  const now = Date.now()
  const tahunWIB = new Date(now + 7 * 3600_000).getUTCFullYear()
  const umur = tahunWIB - config.lahir.tahun
  // Cron Hobby bisa meleset ±1 jam: kirim hanya di sekitar jam ultah, dan cuma sekali per tahun.
  if (Math.abs(now - ultahWIB(umur)) > 3 * 3600_000) return json({ skip: 'bukan hari ultah' })
  if (!(await kv().setnx(`cron:ultah:${tahunWIB}`, '1'))) return json({ skip: 'sudah terkirim' })
  const kapsulBuka = now >= bukaPada() - 10 * 60_000 && now < bukaPada() + 7 * 86400_000
  await notify('dilla', {
    title: `Selamat ulang tahun ke-${umur}, ${config.nama}! 🎂`,
    body: kapsulBuka ? 'Kapsul waktumu sudah terbuka. Ada surat yang nunggu dari setahun lalu 💌' : `Dari ${config.pengirim}, lewat website kecilmu.`,
    url: kapsulBuka ? '/?buka=kapsul' : '/',
    tag: 'ultah',
  })
  if (kapsulBuka) await notify('parid', { title: 'Kapsul waktu terbuka', body: 'Tulisan Dilla buat kamu sudah bisa dibaca.', url: '/?buka=kapsul', tag: 'kapsul' })
  return json({ ok: true, umur, kapsulBuka })
}

export default route({
  async GET(req, url) {
    if (url.searchParams.has('cron')) return cron(req)
    const me = await requireRole(req)
    const buka = bukaPada()
    const terbuka = Date.now() >= buka
    const [mine, theirs] = await Promise.all([isi(me), isi(other(me))])
    return json({
      bukaPada: buka,
      sekarang: Date.now(),
      terbuka,
      punyaku: mine,
      punyanya: terbuka ? theirs : { ada: !!theirs?.teks },
    })
  },

  async PUT(req) {
    const me = await requireRole(req)
    if (Date.now() >= bukaPada()) throw new HttpError(409, 'Kapsulnya sudah terbuka, tulisannya sudah tersegel.')
    await rateLimit(req, 'kapsul', 30, 60)
    const { teks } = await readJson<{ teks?: unknown }>(req, 30_000)
    const t = clampText(teks, MAX_LEN, 'Tulisan')
    const v: Isi = { teks: t, diubah: Date.now() }
    if (t) await kv().set(key(me), JSON.stringify(v))
    else await kv().del(key(me))
    return json({ punyaku: t ? v : null })
  },
})
