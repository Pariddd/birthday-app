// /api/profil — foto profil Dilla & Farid (dipakai di Kotak Surat, lobi, dll).
import { kv } from '../server/kv.js'
import { blob } from '../server/blob.js'
import { route, json, rateLimit } from '../server/http.js'
import { requireRole, other, ROLES, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { readImage, newId, blobPath, fotoSrc } from '../server/gambar.js'
import { config } from '../src/config.js'

const KEY = 'profil'
type Profil = { id: string; at: number }

async function ambil(): Promise<Record<Role, Profil | null>> {
  const h = await kv().hgetall(KEY)
  const out = { dilla: null, parid: null } as Record<Role, Profil | null>
  for (const r of ROLES) {
    try {
      out[r] = h[r] ? (JSON.parse(h[r]) as Profil) : null
    } catch {
      out[r] = null
    }
  }
  return out
}

// Id file baru di tiap ganti foto → URL berubah → cache browser otomatis ikut ganti.
const tampil = (p: Profil | null) => (p ? { src: fotoSrc('profil', p.id), at: p.at } : null)

export default route({
  async GET(req) {
    await requireRole(req)
    const p = await ambil()
    return json({ dilla: tampil(p.dilla), parid: tampil(p.parid) })
  },

  // Body = gambar (sudah dipotong persegi & dikecilkan di HP).
  async POST(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'profil', 10, 600)
    const img = await readImage(req)
    const lama = (await ambil())[me]
    const p: Profil = { id: newId(), at: Date.now() }
    await blob().put(blobPath('profil', p.id), img.data, img.type)
    await kv().hset(KEY, me, JSON.stringify(p))
    if (lama) await blob().del(blobPath('profil', lama.id)).catch(() => {})
    await notify(other(me), {
      title: `${me === 'dilla' ? config.nama : config.pengirim} ganti foto profil ✨`,
      body: 'Intip di Kotak Surat.',
      url: '/?buka=kotak',
      tag: 'profil',
    })
    return json({ [me]: tampil(p) })
  },

  async DELETE(req) {
    const me = await requireRole(req)
    const lama = (await ambil())[me]
    if (lama) {
      await kv().hdel(KEY, me)
      await blob().del(blobPath('profil', lama.id)).catch(() => {})
    }
    return json({ [me]: null })
  },
})
