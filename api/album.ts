// /api/album — Album Kenangan bersama: Dilla & Farid sama-sama bisa upload, kasih ♥, dan hapus fotonya sendiri.
import { kv } from '../server/kv.js'
import { blob } from '../server/blob.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, ROLES, type Role } from '../server/auth.js'
import { readImage, headerText, newId, blobPath, fotoSrc, ID_RE } from '../server/gambar.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'

const KEY = 'album'
const MAX_ITEMS = 400 // ±400 × 400 KB ≈ 160 MB, jauh di bawah kuota Blob gratis 1 GB
const MAX_CAPTION = 140

export type Item = { id: string; by: Role; caption: string; at: number; w: number; h: number; type: string; size: number; love: Role[] }

async function getItem(id: string): Promise<Item | null> {
  const raw = await kv().hget(KEY, id)
  try {
    return raw ? (JSON.parse(raw) as Item) : null
  } catch {
    return null
  }
}

const view = (it: Item) => ({ ...it, src: fotoSrc('album', it.id) })

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

    if ((await kv().hlen(KEY)) >= MAX_ITEMS) throw new HttpError(507, `Album penuh (${MAX_ITEMS} foto). Hapus beberapa dulu ya.`)
    const img = await readImage(req)
    const caption = clampText(headerText(req, 'x-caption'), MAX_CAPTION, 'Keterangan')

    const item: Item = {
      id: newId(),
      by: me,
      caption,
      at: Date.now(),
      w: img.w,
      h: img.h,
      type: img.type,
      size: img.data.length,
      love: [],
    }
    await blob().put(blobPath('album', item.id), img.data, img.type)
    await kv().hset(KEY, item.id, JSON.stringify(item))
    await notify(other(me), {
      title: `${me === 'dilla' ? config.nama : config.pengirim} nambah foto ke album 📸`,
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
    // Masing-masing hapus fotonya sendiri; Farid (admin, peran 'parid') boleh hapus apa saja untuk moderasi.
    if (it.by !== me && me !== 'parid') throw new HttpError(403, 'Foto ini cuma bisa dihapus yang upload')
    await blob().del(blobPath('album', it.id))
    await kv().hdel(KEY, id)
    return json({ ok: true })
  },
})
