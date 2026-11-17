// Web Push (standar browser, tanpa Telegram / layanan pihak ketiga selain push service bawaan browser).
import { setVapidDetails, sendNotification, WebPushError, type PushSubscription } from 'web-push'
import { createHash } from 'node:crypto'
import { kv } from './kv.js'
import type { Role } from './auth.js'

export const subKey = (r: Role) => `push:${r}`
export const endpointId = (endpoint: string) => createHash('sha256').update(endpoint).digest('base64url').slice(0, 22)

let ready: boolean | null = null
export function pushReady() {
  if (ready !== null) return ready
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (ready = false)
  setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv)
  return (ready = true)
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

/** Kirim notifikasi ke semua perangkat milik `role`. Tidak pernah melempar error. */
export async function notify(role: Role, payload: PushPayload) {
  if (!pushReady()) return 0
  try {
    const subs = await kv().hgetall(subKey(role))
    const results = await Promise.allSettled(
      Object.entries(subs).map(async ([id, raw]) => {
        try {
          await sendNotification(JSON.parse(raw) as PushSubscription, JSON.stringify(payload), {
            TTL: 60 * 60 * 24 * 3,
            urgency: 'normal',
            topic: payload.tag?.slice(0, 32),
            timeout: 6000,
          })
          return true
        } catch (e) {
          // 404/410 = langganan sudah tidak berlaku (izin dicabut / app dihapus) → buang.
          if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) await kv().hdel(subKey(role), id)
          else console.warn('push gagal', e instanceof WebPushError ? e.statusCode : e)
          return false
        }
      }),
    )
    return results.filter((r) => r.status === 'fulfilled' && r.value).length
  } catch (e) {
    console.warn('push error', e)
    return 0
  }
}
