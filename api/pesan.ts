// /api/pesan — Kotak Surat dua arah (Dilla ⇄ Farid).
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'

const LIST = 'msg:list'
const SEQ = 'msg:seq'
const READ = 'msg:read'
const KEEP = 500 // simpan 500 surat terakhir
const MAX_LEN = 1000

export type Msg = { id: number; from: Role; text: string; at: number }

async function readMarkers() {
  const r = await kv().hgetall(READ)
  return { dilla: Number(r.dilla || 0), parid: Number(r.parid || 0) }
}

async function all(): Promise<Msg[]> {
  return (await kv().lrange(LIST, 0, -1)).flatMap((s) => {
    try {
      return [JSON.parse(s) as Msg]
    } catch {
      return []
    }
  })
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
    const messages = seq > after ? (await all()).filter((m) => m.id > after) : []
    return json({ messages, read, seq, me })
  },

  async POST(req) {
    const me = await requireRole(req)
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

    const id = await kv().incr(SEQ)
    const msg: Msg = { id, from: me, text, at: Date.now() }
    await kv().rpush(LIST, JSON.stringify(msg))
    await Promise.all([kv().ltrim(LIST, -KEEP, -1), kv().hset(READ, me, String(id))])

    // Isi surat sengaja TIDAK ditaruh di notifikasi (bisa terbaca di layar kunci).
    await notify(other(me), {
      title: me === 'dilla' ? `Surat baru dari ${config.nama}` : `Ada surat baru dari ${config.pengirim}`,
      body: 'Buka Kotak Surat buat baca ya.',
      url: '/?buka=kotak',
      tag: 'pesan',
    })
    return json({ message: msg })
  },
})
