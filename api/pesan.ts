// /api/pesan — Kotak Surat dua arah (Dilla ⇄ Farid): teks dan foto.
import { kv } from '../server/kv.js'
import { blob } from '../server/blob.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { readImage, headerText, newId, blobPath, fotoSrc } from '../server/gambar.js'
import { config } from '../src/config.js'

const LIST = 'msg:list'
const SEQ = 'msg:seq'
const READ = 'msg:read'
const KEEP = 500 // simpan 500 surat terakhir
const MAX_LEN = 1000
const MAX_CAPTION = 300 // teks yang menyertai foto dikirim lewat header, jadi dibatasi lebih pendek
const FOTO_HARIAN = 60

export type Msg = { id: number; from: Role; text: string; at: number; foto?: { id: string; w: number; h: number } }

const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)

async function readMarkers() {
  const r = await kv().hgetall(READ)
  return { dilla: Number(r.dilla || 0), parid: Number(r.parid || 0) }
}

const parse = (s: string): Msg[] => {
  try {
    return [JSON.parse(s) as Msg]
  } catch {
    return []
  }
}
async function all(): Promise<Msg[]> {
  return (await kv().lrange(LIST, 0, -1)).flatMap(parse)
}

/** Tambahkan URL foto bertoken (token dibuat baru tiap kali diambil). */
const tampil = (m: Msg) => (m.foto ? { ...m, foto: { ...m.foto, src: fotoSrc('pesan', m.foto.id) } } : m)

/** Simpan surat; kalau daftar melebihi KEEP, buang yang paling lama beserta fotonya di Blob. */
async function simpan(msg: Msg) {
  const len = await kv().rpush(LIST, JSON.stringify(msg))
  if (len > KEEP) {
    const lama = (await kv().lrange(LIST, 0, len - KEEP - 1)).flatMap(parse)
    await kv().ltrim(LIST, -KEEP, -1)
    await Promise.allSettled(lama.filter((m) => m.foto).map((m) => blob().del(blobPath('pesan', m.foto!.id))))
  }
  await kv().hset(READ, msg.from, String(msg.id))
}

export default route({
  // GET ?after=<id>  → surat baru setelah id tsb + penanda "sudah dibaca"
  // GET ?ringkas=1   → hanya jumlah belum dibaca (untuk badge)
  async GET(req, url) {
    const me = await requireRole(req)
    const after = Math.max(0, Number(url.searchParams.get('after')) || 0)
    const [seqRaw, read] = await Promise.all([kv().get(SEQ), readMarkers()])
    const seq = Number(seqRaw || 0)

    if (url.searchParams.has('ringkas')) {
      if (seq <= read[me]) return json({ unread: 0, seq })
      const unread = (await all()).filter((m) => m.from !== me && m.id > read[me]).length
      return json({ unread, seq })
    }

    // Polling murah: kalau tidak ada surat baru, tidak perlu ambil daftar.
    const messages = seq > after ? (await all()).filter((m) => m.id > after).map(tampil) : []
    return json({ messages, read, seq, me })
  },

  // JSON { text } = surat teks · JSON { action:'read', upTo } = tandai dibaca
  // body gambar (image/*) + header x-text = surat foto
  async POST(req) {
    const me = await requireRole(req)
    const isFoto = (req.headers.get('content-type') || '').startsWith('image/')

    if (!isFoto) {
      const body = await readJson<{ action?: string; text?: unknown; upTo?: unknown }>(req, 8000)
      if (body.action === 'read') {
        const seq = Number((await kv().get(SEQ)) || 0)
        const upTo = Math.min(seq, Math.max(0, Math.floor(Number(body.upTo) || 0)))
        const cur = (await readMarkers())[me]
        if (upTo > cur) await kv().hset(READ, me, String(upTo))
        return json({ ok: true })
      }
      await rateLimit(req, 'pesan', 20, 60)
      const text = clampText(body.text, MAX_LEN, 'Surat')
      if (!text) throw new HttpError(400, 'Suratnya masih kosong')
      const msg: Msg = { id: await kv().incr(SEQ), from: me, text, at: Date.now() }
      await simpan(msg)
      // Isi surat sengaja TIDAK ditaruh di notifikasi (bisa terbaca di layar kunci).
      await notify(other(me), {
        title: me === 'dilla' ? `Surat baru dari ${config.nama}` : `Ada surat baru dari ${config.pengirim}`,
        body: 'Buka Kotak Surat buat baca ya.',
        url: '/?buka=kotak',
        tag: 'pesan',
      })
      return json({ message: msg })
    }

    // ---- surat foto ----
    await rateLimit(req, 'pesan', 20, 60)
    const daily = await kv().incr(`pesan:foto:${me}:${new Date().toISOString().slice(0, 10)}`, 90_000)
    if (daily > FOTO_HARIAN) throw new HttpError(429, `Hari ini sudah ${FOTO_HARIAN} foto. Lanjut besok ya.`)
    const text = clampText(headerText(req, 'x-text'), MAX_CAPTION, 'Keterangan foto')
    const img = await readImage(req)
    const fotoId = newId()
    await blob().put(blobPath('pesan', fotoId), img.data, img.type)
    const msg: Msg = { id: await kv().incr(SEQ), from: me, text, at: Date.now(), foto: { id: fotoId, w: img.w, h: img.h } }
    await simpan(msg)
    await notify(other(me), {
      title: `${nama(me)} ngirim foto 📷`,
      body: 'Buka Kotak Surat buat lihat ya.',
      url: '/?buka=kotak',
      tag: 'pesan',
    })
    return json({ message: tampil(msg) })
  },
})
