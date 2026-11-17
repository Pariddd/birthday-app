// /api/push — daftar / lepas langganan notifikasi Web Push per perangkat.
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, HttpError } from '../server/http.js'
import { requireRole } from '../server/auth.js'
import { notify, pushReady, subKey, endpointId } from '../server/push.js'

const MAX_DEVICES = 8
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

function validSub(s: Sub | undefined): s is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return false
  let u: URL
  try {
    u = new URL(s.endpoint)
  } catch {
    return false
  }
  // Hanya push service resmi browser (Chrome/Edge/Firefox/Safari). Mencegah server dipakai
  // menembak URL sembarang (SSRF) lewat data langganan palsu.
  if (u.protocol !== 'https:' || !PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return false
  const k = s.keys
  return !!k && typeof k.p256dh === 'string' && typeof k.auth === 'string' && k.p256dh.length < 200 && k.auth.length < 100
}

export default route({
  async GET() {
    // Kunci publik VAPID memang publik (dipakai browser untuk berlangganan).
    const publicKey = pushReady() ? process.env.VAPID_PUBLIC_KEY : null
    return json({ publicKey, ready: !!publicKey })
  },

  async POST(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'push', 20, 600)
    const body = await readJson<{ action?: string; subscription?: Sub; endpoint?: unknown }>(req, 4000)

    if (body.action === 'test') {
      const n = await notify(me, { title: 'Notifikasi aktif ✨', body: 'Kalau kamu lihat ini, berarti sudah nyambung.', tag: 'tes' })
      return json({ sent: n })
    }

    if (body.action === 'unsubscribe') {
      if (typeof body.endpoint === 'string') await kv().hdel(subKey(me), endpointId(body.endpoint))
      return json({ ok: true })
    }

    if (!pushReady()) throw new HttpError(503, 'Notifikasi belum disetel di server (VAPID).')
    const s = body.subscription
    if (!validSub(s)) throw new HttpError(400, 'Data langganan tidak valid')
    const id = endpointId(s.endpoint)
    const existing = await kv().hgetall(subKey(me))
    if (!(id in existing) && Object.keys(existing).length >= MAX_DEVICES) {
      // Buang perangkat paling lama supaya tidak menumpuk.
      const oldest = Object.entries(existing).sort((a, b) => (JSON.parse(a[1]).at ?? 0) - (JSON.parse(b[1]).at ?? 0))[0]
      if (oldest) await kv().hdel(subKey(me), oldest[0])
    }
    await kv().hset(subKey(me), id, JSON.stringify({ endpoint: s.endpoint, keys: s.keys, at: Date.now() }))
    return json({ ok: true })
  },
})
