// /api/album — Album Kenangan bersama: Dilla & Farid sama-sama bisa upload foto & video, kasih ♥,
// dan hapus miliknya sendiri.
//
// Alur video (file video bisa jauh di atas batas 4,5 MB fungsi Vercel):
//   1. Browser minta URL upload presigned ke sini (JSON { type: 'blob.generate-presigned-url' }),
//      lalu mengunggah video LANGSUNG ke Vercel Blob (private) ke path video/<id>.
//      (Lokal / tanpa Blob: video kecil diunggah lewat POST ?unggah=video.)
//   2. Browser mengirim poster (gambar dari frame video) + header x-video=<id> → item album dibuat
//      setelah server memastikan file videonya benar-benar ada (head) dan ukurannya wajar.
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client'
import { issueSignedToken } from '@vercel/blob'
import { kv } from '../server/kv.js'
import { blob } from '../server/blob.js'
import { route, json, readJson, rateLimit, clampText, HttpError } from '../server/http.js'
import { requireRole, other, ROLES, type Role } from '../server/auth.js'
import { readImage, headerText, newId, blobPath, fotoSrc, ID_RE, VIDEO_TYPES, MAX_VIDEO, MAX_DURASI, sniffVideo } from '../server/gambar.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'
import { siram } from '../server/streak.js'

const KEY = 'album'
const MAX_ITEMS = 400 // ±400 × 400 KB ≈ 160 MB, jauh di bawah kuota Blob gratis 1 GB
const MAX_CAPTION = 140
const MAX_TOTAL = 850 * 1024 * 1024 // sisakan ruang di kuota Blob gratis 1 GB (foto chat & profil juga di sana)
const MAX_VIDEO_LEWAT_FUNGSI = process.env.VERCEL ? 4 * 1024 * 1024 : MAX_VIDEO
const VIDEO_PATH = /^video\/([a-z0-9]{10,24})$/

type Video = { id: string; dur: number; size: number; type: string }
export type Item = { id: string; by: Role; caption: string; at: number; w: number; h: number; type: string; size: number; love: Role[]; video?: Video }

async function semua(): Promise<Item[]> {
  return Object.values(await kv().hgetall(KEY)).flatMap((s) => {
    try {
      return [JSON.parse(s) as Item]
    } catch {
      return []
    }
  })
}
const terpakai = (items: Item[]) => items.reduce((n, it) => n + (it.size || 0) + (it.video?.size || 0), 0)

async function cekKuota(tambahan: number) {
  if (terpakai(await semua()) + tambahan > MAX_TOTAL) throw new HttpError(507, 'Penyimpanan album hampir penuh. Hapus beberapa video/foto lama dulu ya.')
}

async function getItem(id: string): Promise<Item | null> {
  const raw = await kv().hget(KEY, id)
  try {
    return raw ? (JSON.parse(raw) as Item) : null
  } catch {
    return null
  }
}

const view = (it: Item) => ({ ...it, src: fotoSrc('album', it.id), videoSrc: it.video ? fotoSrc('video', it.video.id) : undefined })

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
    return json({ items, max: MAX_ITEMS, video: { langsung: blob().remote, maxBytes: MAX_VIDEO, maxLewatFungsi: MAX_VIDEO_LEWAT_FUNGSI, maxDurasi: MAX_DURASI } })
  },

  // Body = file gambar mentah (bukan multipart). Metadata lewat header.
  async POST(req, url) {
    const me = await requireRole(req)
    const ct = req.headers.get('content-type') || ''

    // (1a) Minta URL upload presigned untuk video (upload langsung browser → Blob).
    if (ct.startsWith('application/json')) {
      await rateLimit(req, 'unggah', 20, 600)
      if (!blob().remote) throw new HttpError(501, 'Upload langsung belum tersedia di sini.')
      const body = await readJson<HandleUploadPresignedBody>(req, 4000)
      const res = await handleUploadPresigned({
        body,
        request: req,
        getSignedToken: async (pathname) => {
          if (!VIDEO_PATH.test(pathname)) throw new HttpError(400, 'Path video tidak valid')
          await cekKuota(MAX_VIDEO)
          const validUntil = Date.now() + 30 * 60_000
          const token = await issueSignedToken({ pathname, operations: ['put'], validUntil, allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_VIDEO })
          return { token, urlOptions: { validUntil, allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_VIDEO, addRandomSuffix: false, allowOverwrite: false } }
        },
      })
      return json(res)
    }

    // (1b) Video kecil lewat fungsi (dev lokal, atau cadangan kalau upload langsung gagal).
    if (url.searchParams.get('unggah') === 'video') {
      await rateLimit(req, 'unggah', 20, 600)
      const len = Number(req.headers.get('content-length') || 0)
      if (len > MAX_VIDEO_LEWAT_FUNGSI) throw new HttpError(413, 'Videonya kebesaran untuk jalur ini.')
      const data = new Uint8Array(await req.arrayBuffer())
      if (!data.length || data.length > MAX_VIDEO_LEWAT_FUNGSI) throw new HttpError(413, 'Videonya kebesaran untuk jalur ini.')
      const type = sniffVideo(data)
      if (!type) throw new HttpError(415, 'Itu bukan video MP4/MOV/WebM.')
      await cekKuota(data.length)
      const vid = newId()
      await blob().put(blobPath('video', vid), data, type)
      return json({ vid })
    }

    await rateLimit(req, 'album', 15, 60)
    const daily = await kv().incr(`album:harian:${me}:${new Date().toISOString().slice(0, 10)}`, 90_000)
    if (daily > 60) throw new HttpError(429, 'Hari ini sudah 60 foto. Lanjut besok ya.')

    if ((await kv().hlen(KEY)) >= MAX_ITEMS) throw new HttpError(507, `Album penuh (${MAX_ITEMS} foto). Hapus beberapa dulu ya.`)
    const img = await readImage(req)
    const caption = clampText(headerText(req, 'x-caption'), MAX_CAPTION, 'Keterangan')

    // (2) Poster + daftarkan video yang sudah terunggah.
    let video: Video | undefined
    const vid = req.headers.get('x-video')
    if (vid) {
      if (!ID_RE.test(vid)) throw new HttpError(400, 'id video tidak valid')
      const h = await blob().head(blobPath('video', vid))
      if (!h) throw new HttpError(404, 'Videonya belum sampai di server. Coba upload lagi ya.')
      if (!VIDEO_TYPES.includes(h.contentType.split(';')[0]) || h.size > MAX_VIDEO) {
        await blob().del(blobPath('video', vid))
        throw new HttpError(415, 'File video tidak didukung.')
      }
      // Satu video hanya boleh didaftarkan sekali.
      if (!(await kv().setnx(`album:video:${vid}`, me))) throw new HttpError(409, 'Video ini sudah ada di album.')
      try {
        await cekKuota(h.size + img.data.length)
      } catch (e) {
        await blob().del(blobPath('video', vid))
        throw e
      }
      const dur = Math.max(0, Math.min(MAX_DURASI + 5, Math.round(Number(req.headers.get('x-dur')) || 0)))
      video = { id: vid, dur, size: h.size, type: h.contentType.split(';')[0] }
    }

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
      ...(video ? { video } : {}),
    }
    await blob().put(blobPath('album', item.id), img.data, img.type)
    await kv().hset(KEY, item.id, JSON.stringify(item))
    await siram(me, { dilla: config.nama, parid: config.pengirim })
    await notify(other(me), {
      title: `${me === 'dilla' ? config.nama : config.pengirim} nambah ${video ? 'video 🎬' : 'foto 📸'} ke album`,
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
    if (it.video) await blob().del(blobPath('video', it.video.id)).catch(() => {})
    await kv().hdel(KEY, id)
    return json({ ok: true })
  },
})
