// /api/album — Album Kenangan bersama: Dilla & Parid sama-sama bisa upload, kasih ♥, dan hapus fotonya sendiri.
import { randomBytes } from 'node:crypto'
import { kv } from '../server/kv.js'
import { blob } from '../server/blob.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, viewToken, other, ROLES, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'

const KEY = 'album'
const MAX_BYTES = 4 * 1024 * 1024 // batas body Vercel Function 4,5 MB
const MAX_ITEMS = 400 // ±400 × 400 KB ≈ 160 MB, jauh di bawah kuota Blob gratis 1 GB
const MAX_CAPTION = 140
export const ID_RE = /^[a-z0-9]{10,24}$/

export type Item = { id: string; by: Role; caption: string; at: number; w: number; h: number; type: string; size: number; love: Role[] }

// Tanpa ekstensi: /api/foto cukup tahu id-nya (tipe file disimpan sebagai content-type blob).
export const blobPath = (id: string) => `album/${id}`

/** Cek "magic bytes": isi file harus benar-benar gambar sesuai tipe yang diklaim. */
function sniff(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png'
  const ascii = (s: number, e: number) => String.fromCharCode(...b.subarray(s, e))
  if (b.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

async function getItem(id: string): Promise<Item | null> {
  const raw = await kv().hget(KEY, id)
  try {
    return raw ? (JSON.parse(raw) as Item) : null
  } catch {
    return null
  }
}

const view = (it: Item) => ({ ...it, src: `/api/foto?id=${it.id}&t=${viewToken(it.id)}` })

export default route({
  async GET(req) {
    await requireRole(req)
    const all = await kv().hgetall(KEY)
    const items = Object.values(all)
      .flatMap((s) => {
        try {
          return [JSON.parse(s) as Item]
        } catch {
          return []
        }
      })
      .sort((a, b) => b.at - a.at)
      .map(view)
    return json({ items, max: MAX_ITEMS })
  },

  // Body = file gambar mentah (bukan multipart). Metadata lewat header.
  async POST(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'album', 15, 60)
    const daily = await kv().incr(`album:harian:${me}:${new Date().toISOString().slice(0, 10)}`, 90_000)
    if (daily > 60) throw new HttpError(429, 'Hari ini sudah 60 foto. Lanjut besok ya.')

    const len = Number(req.headers.get('content-length') || 0)
    if (len > MAX_BYTES) throw new HttpError(413, 'Fotonya kebesaran (maks 4 MB).')
    if ((await kv().hlen(KEY)) >= MAX_ITEMS) throw new HttpError(507, `Album penuh (${MAX_ITEMS} foto). Hapus beberapa dulu ya.`)

    const data = new Uint8Array(await req.arrayBuffer())
    if (!data.length) throw new HttpError(400, 'Fotonya kosong')
    if (data.length > MAX_BYTES) throw new HttpError(413, 'Fotonya kebesaran (maks 4 MB).')
    const type = sniff(data)
    if (!type) throw new HttpError(415, 'Itu bukan foto JPG/PNG/WEBP.')

    let caption = ''
    try {
      caption = clampText(decodeURIComponent(req.headers.get('x-caption') || ''), MAX_CAPTION, 'Keterangan')
    } catch (e) {
      if (e instanceof HttpError) throw e
      throw new HttpError(400, 'Keterangan tidak valid')
    }
    const dim = (h: string) => Math.max(0, Math.min(10000, Math.floor(Number(req.headers.get(h)) || 0)))

    const item: Item = {
      id: Date.now().toString(36) + randomBytes(5).toString('hex'),
      by: me,
      caption,
      at: Date.now(),
      w: dim('x-w'),
      h: dim('x-h'),
      type,
      size: data.length,
      love: [],
    }
    await blob().put(blobPath(item.id), data, type)
    await kv().hset(KEY, item.id, JSON.stringify(item))
    await notify(other(me), {
      title: me === 'dilla' ? 'Dilla nambah foto ke album 📸' : 'Parid nambah foto ke album 📸',
      body: caption ? `“${caption.slice(0, 60)}”` : 'Intip di Album Kenangan.',
      url: '/?buka=kenangan',
      tag: 'album',
    })
    return json({ item: view(item) }, 201)
  },

  // { id, love: boolean } atau { id, caption }
  async PATCH(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'album-edit', 60, 60)
    const body = await readJson<{ id?: unknown; love?: unknown; caption?: unknown }>(req, 2000)
    if (typeof body.id !== 'string' || !ID_RE.test(body.id)) throw new HttpError(400, 'id tidak valid')
    const it = await getItem(body.id)
    if (!it) throw new HttpError(404, 'Fotonya sudah tidak ada')
    if (typeof body.love === 'boolean') {
      const set = new Set(it.love.filter((r) => ROLES.includes(r)))
      if (body.love) set.add(me)
      else set.delete(me)
      it.love = [...set]
    }
    if (body.caption !== undefined) {
      if (it.by !== me) throw new HttpError(403, 'Keterangan cuma bisa diubah yang upload')
      it.caption = clampText(body.caption, MAX_CAPTION, 'Keterangan')
    }
    await kv().hset(KEY, it.id, JSON.stringify(it))
    return json({ item: view(it) })
  },

  async DELETE(req, url) {
    const me = await requireRole(req)
    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id)) throw new HttpError(400, 'id tidak valid')
    const it = await getItem(id)
    if (!it) return json({ ok: true })
    // Masing-masing hapus fotonya sendiri; Parid (admin) boleh hapus apa saja untuk moderasi.
    if (it.by !== me && me !== 'parid') throw new HttpError(403, 'Foto ini cuma bisa dihapus yang upload')
    await blob().del(blobPath(it.id))
    await kv().hdel(KEY, id)
    return json({ ok: true })
  },
})
