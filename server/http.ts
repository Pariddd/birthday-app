import { kv } from './kv.js'

export class HttpError extends Error {
  status: number
  extra?: Record<string, unknown>
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type Handler = (req: Request, url: URL) => Promise<Response>

/**
 * Bungkus handler per metode HTTP + penanganan error yang seragam.
 * Dikembalikan sebagai `{ fetch }` (export Web Standard Vercel). PENTING: `export default function (req)`
 * biasa dianggap Vercel sebagai handler Node `(req, res)` → req bukan Request, respons tidak pernah terkirim.
 */
export function route(handlers: Partial<Record<Method, Handler>>) {
  return { fetch: handler }
  async function handler(req: Request): Promise<Response> {
    const h = handlers[req.method as Method]
    if (!h) return json({ error: 'Metode tidak didukung' }, 405, { allow: Object.keys(handlers).join(', ') })
    try {
      return await h(req, new URL(req.url))
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status)
      console.error(e)
      return json({ error: 'Server lagi error. Coba lagi sebentar ya.' }, 500)
    }
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 16_000): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > maxBytes) throw new HttpError(413, 'Isinya kepanjangan')
  const text = await req.text()
  if (text.length > maxBytes) throw new HttpError(413, 'Isinya kepanjangan')
  try {
    const v = JSON.parse(text || '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error()
    return v as T
  } catch {
    throw new HttpError(400, 'Format data tidak valid')
  }
}

export function clientIp(req: Request) {
  // Di Vercel, x-forwarded-for diisi oleh edge Vercel (klien tidak bisa memalsukan entri pertama).
  const xff = req.headers.get('x-forwarded-for')
  return (xff?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim()
}

/** Fixed-window rate limit. Lempar 429 kalau lewat batas. */
export async function rateLimit(req: Request, name: string, limit: number, windowSec: number) {
  const win = Math.floor(Date.now() / 1000 / windowSec)
  const n = await kv().incr(`rl:${name}:${clientIp(req)}:${win}`, windowSec + 5)
  if (n > limit) throw new HttpError(429, 'Pelan-pelan ya, coba lagi sebentar lagi.')
}

export function clampText(v: unknown, max: number, field = 'Teks') {
  if (typeof v !== 'string') throw new HttpError(400, `${field} wajib diisi`)
  // Normalisasi baris baru & buang karakter kontrol (kecuali \n dan \t).
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
  if ([...t].length > max) throw new HttpError(400, `${field} maksimal ${max} karakter`)
  return t
}
