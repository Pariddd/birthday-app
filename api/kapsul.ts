// /api/kapsul — Kapsul Waktu: Dilla & Farid saling menitipkan surat yang baru bisa dibuka pada waktu
// yang dipilih penulisnya. Kuncinya di SERVER: sebelum waktunya, isi surat tidak pernah dikirim ke penerima.
import { randomBytes } from 'node:crypto'
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, safeEqual, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'
import { siram } from '../server/streak.js'

const KEY = 'kapsul:item'
const MAX_TEKS = 6000
const MAX_LABEL = 60
const MAX_ITEMS = 100
const MIN_JEDA = 60_000 // minimal 1 menit dari sekarang
const MAX_JEDA = 10 * 365 * 86_400_000 // maksimal 10 tahun
const ID_RE = /^[a-z0-9]{10,24}$/

type Kapsul = {
  id: string
  from: Role
  label: string // petunjuk di amplop, terlihat sebelum dibuka
  teks: string
  bukaPada: number
  dibuat: number
  diubah: number
  dibaca: Role[] // siapa saja yang sudah membuka amplopnya
  dikabari?: boolean // notifikasi "hari ini terbuka" sudah dikirim
}

const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)
const fmtWaktu = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
const jamWIB = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })

/** 00:00 WIB (UTC+7) di hari ulang tahun ke-`umur`. */
const ultahWIB = (umur: number) => Date.UTC(config.lahir.tahun + umur, config.lahir.bulan - 1, config.lahir.tanggal) - 7 * 3600_000

async function semua(): Promise<Kapsul[]> {
  return Object.values(await kv().hgetall(KEY)).flatMap((s) => {
    try {
      return [JSON.parse(s) as Kapsul]
    } catch {
      return []
    }
  })
}
async function ambil(id: string): Promise<Kapsul | null> {
  const raw = await kv().hget(KEY, id)
  try {
    return raw ? (JSON.parse(raw) as Kapsul) : null
  } catch {
    return null
  }
}
const simpan = (k: Kapsul) => kv().hset(KEY, k.id, JSON.stringify(k))

/** Yang dikirim ke browser. Penerima TIDAK mendapat teks sebelum waktunya. */
function tampil(k: Kapsul, me: Role, now: number) {
  const terbuka = now >= k.bukaPada
  const base = { id: k.id, from: k.from, label: k.label, bukaPada: k.bukaPada, dibuat: k.dibuat, terbuka, dibaca: k.dibaca }
  if (k.from === me || terbuka) return { ...base, teks: k.teks, diubah: k.diubah }
  return base
}

function cekWaktu(v: unknown, now: number) {
  const t = Number(v)
  if (!Number.isFinite(t)) throw new HttpError(400, 'Waktu buka belum diisi')
  if (t < now + MIN_JEDA) throw new HttpError(400, 'Waktu bukanya harus di masa depan ya')
  if (t > now + MAX_JEDA) throw new HttpError(400, 'Maksimal 10 tahun dari sekarang')
  return Math.floor(t)
}

// Dipanggil Vercel Cron tiap hari 00:05 WIB (lihat vercel.json):
// 1) ucapan ultah di hari ulang tahun, 2) kabar kapsul yang terbuka hari ini.
async function cron(req: Request) {
  const s = process.env.CRON_SECRET
  const h = req.headers.get('authorization') || ''
  if (!s || !safeEqual(h, `Bearer ${s}`)) throw new HttpError(401, 'unauthorized')
  const now = Date.now()
  const hasil: Record<string, unknown> = {}

  // 1) ulang tahun (hanya sekali per tahun; cron Hobby bisa meleset ±1 jam)
  const tahunWIB = new Date(now + 7 * 3600_000).getUTCFullYear()
  const umur = tahunWIB - config.lahir.tahun
  if (Math.abs(now - ultahWIB(umur)) <= 3 * 3600_000 && (await kv().setnx(`cron:ultah:${tahunWIB}`, '1'))) {
    await notify('dilla', {
      title: `Selamat ulang tahun ke-${umur}, ${config.nama}! 🎂`,
      body: `Dari ${config.pengirim}, lewat website kecilmu.`,
      url: '/',
      tag: 'ultah',
    })
    hasil.ultah = umur
  }

  // 2) kapsul yang waktu bukanya jatuh sebelum cron berikutnya (≤ 24 jam ke depan) atau sudah lewat
  const hariIni = (await semua()).filter((k) => !k.dikabari && k.bukaPada <= now + 24 * 3600_000)
  for (const k of hariIni) {
    const untuk = other(k.from)
    const sudah = k.bukaPada <= now
    await notify(untuk, {
      title: sudah ? `Kapsul dari ${nama(k.from)} sudah terbuka 💌` : `Hari ini ada kapsul dari ${nama(k.from)} 💌`,
      body: sudah ? (k.label ? `“${k.label}”` : 'Buka Kapsul Waktu buat baca.') : `Terbuka jam ${jamWIB(k.bukaPada)} WIB${k.label ? ` · “${k.label}”` : ''}`,
      url: '/?buka=kapsul',
      tag: `kapsul-${k.id}`.slice(0, 32),
    })
    await simpan({ ...k, dikabari: true })
  }
  hasil.kapsul = hariIni.length
  return json({ ok: true, ...hasil })
}

export default route({
  async GET(req, url) {
    if (url.searchParams.has('cron')) return cron(req)
    const me = await requireRole(req)
    const now = Date.now()
    const items = (await semua())
      .filter((k) => k.from === me || k.from === other(me))
      .sort((a, b) => a.bukaPada - b.bukaPada)
      .map((k) => tampil(k, me, now))
    return json({ sekarang: now, items, ultahBerikut: ultahBerikut(now), umurBerikut: umurBerikut(now) })
  },

  // Buat kapsul baru: { teks, label?, bukaPada }
  async POST(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'kapsul', 20, 60)
    const b = await readJson<{ teks?: unknown; label?: unknown; bukaPada?: unknown }>(req, 30_000)
    const now = Date.now()
    const teks = clampText(b.teks, MAX_TEKS, 'Surat')
    if (!teks) throw new HttpError(400, 'Suratnya masih kosong')
    const label = b.label === undefined ? '' : clampText(b.label, MAX_LABEL, 'Petunjuk')
    const bukaPada = cekWaktu(b.bukaPada, now)
    if ((await kv().hlen(KEY)) >= MAX_ITEMS) throw new HttpError(507, `Sudah ${MAX_ITEMS} kapsul. Hapus yang lama dulu ya.`)

    const k: Kapsul = { id: now.toString(36) + randomBytes(5).toString('hex'), from: me, label, teks, bukaPada, dibuat: now, diubah: now, dibaca: [] }
    await simpan(k)
    await siram(me, { dilla: config.nama, parid: config.pengirim })
    await notify(other(me), {
      title: `${nama(me)} menitipkan kapsul waktu 💌`,
      body: `Baru bisa dibuka ${fmtWaktu(bukaPada)}.`,
      url: '/?buka=kapsul',
      tag: 'kapsul-baru',
    })
    return json({ item: tampil(k, me, now) }, 201)
  },

  // Ubah kapsul sendiri yang belum terbuka: { id, teks?, label?, bukaPada? }
  // atau tandai sudah dibaca: { id, baca: true }
  async PUT(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'kapsul', 20, 60)
    const b = await readJson<{ id?: unknown; teks?: unknown; label?: unknown; bukaPada?: unknown; baca?: unknown }>(req, 30_000)
    if (typeof b.id !== 'string' || !ID_RE.test(b.id)) throw new HttpError(400, 'id tidak valid')
    const k = await ambil(b.id)
    if (!k) throw new HttpError(404, 'Kapsulnya sudah tidak ada')
    const now = Date.now()

    if (b.baca === true) {
      if (now < k.bukaPada) throw new HttpError(409, 'Belum waktunya dibuka')
      if (!k.dibaca.includes(me)) {
        k.dibaca = [...k.dibaca, me]
        await simpan(k)
        if (k.from !== me) {
          await notify(k.from, { title: `${nama(me)} sudah membuka kapsulmu 💌`, body: k.label ? `“${k.label}”` : 'Kapsul Waktu', url: '/?buka=kapsul', tag: 'kapsul-dibaca' })
        }
      }
      return json({ item: tampil(k, me, now) })
    }

    if (k.from !== me) throw new HttpError(403, 'Kapsul ini cuma bisa diubah penulisnya')
    if (now >= k.bukaPada) throw new HttpError(409, 'Kapsulnya sudah terbuka, isinya sudah tersegel.')
    if (b.teks !== undefined) {
      const t = clampText(b.teks, MAX_TEKS, 'Surat')
      if (!t) throw new HttpError(400, 'Suratnya masih kosong')
      k.teks = t
    }
    if (b.label !== undefined) k.label = clampText(b.label, MAX_LABEL, 'Petunjuk')
    if (b.bukaPada !== undefined) k.bukaPada = cekWaktu(b.bukaPada, now)
    k.diubah = now
    k.dikabari = false
    await simpan(k)
    return json({ item: tampil(k, me, now) })
  },

  // Hapus kapsul sendiri yang BELUM terbuka (yang sudah terbuka jadi kenangan berdua).
  async DELETE(req, url) {
    const me = await requireRole(req)
    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id)) throw new HttpError(400, 'id tidak valid')
    const k = await ambil(id)
    if (!k) return json({ ok: true })
    if (k.from !== me) throw new HttpError(403, 'Kapsul ini cuma bisa dihapus penulisnya')
    if (Date.now() >= k.bukaPada) throw new HttpError(409, 'Kapsul yang sudah terbuka tidak bisa dihapus')
    await kv().hdel(KEY, id)
    return json({ ok: true })
  },
})

/** Ulang tahun Dilla berikutnya (00:00 WIB) — dipakai sebagai pilihan cepat di form. */
function ultahBerikut(now: number) {
  const y = new Date(now + 7 * 3600_000).getUTCFullYear()
  const u = ultahWIB(y - config.lahir.tahun)
  return u > now + MIN_JEDA ? u : ultahWIB(y + 1 - config.lahir.tahun)
}
const umurBerikut = (now: number) => new Date(ultahBerikut(now) + 7 * 3600_000).getUTCFullYear() - config.lahir.tahun
