// Penyimpanan key-value.
// - Produksi (Vercel): Upstash Redis lewat REST (env dari Vercel Marketplace).
// - Lokal (`npm run dev`): file JSON di .data/kv.json, supaya bisa dites tanpa akun apa pun.
import { Redis } from '@upstash/redis'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface KV {
  get(key: string): Promise<string | null>
  set(key: string, value: string, exSeconds?: number): Promise<void>
  /** set hanya jika key belum ada. true = berhasil. */
  setnx(key: string, value: string): Promise<boolean>
  del(key: string): Promise<void>
  /** INCR; kalau key baru dibuat, TTL dipasang `exSeconds`. */
  incr(key: string, exSeconds?: number): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hset(key: string, field: string, value: string): Promise<void>
  hdel(key: string, field: string): Promise<void>
  hgetall(key: string): Promise<Record<string, string>>
  hlen(key: string): Promise<number>
  rpush(key: string, value: string): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  ltrim(key: string, start: number, stop: number): Promise<void>
}

const str = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v))

function upstash(url: string, token: string): KV {
  // automaticDeserialization:false → nilai selalu string apa adanya (kita yang JSON.parse sendiri).
  const r = new Redis({ url, token, automaticDeserialization: false })
  return {
    get: async (k) => str(await r.get(k)),
    set: async (k, v, ex) => {
      if (ex) await r.set(k, v, { ex })
      else await r.set(k, v)
    },
    setnx: async (k, v) => (await r.set(k, v, { nx: true })) !== null,
    del: async (k) => void (await r.del(k)),
    incr: async (k, ex) => {
      if (!ex) return Number(await r.incr(k))
      // SET NX EX dulu lalu INCR (INCR mempertahankan TTL) dalam satu request pipeline,
      // supaya tidak pernah ada counter tanpa TTL (yang bisa mengunci selamanya).
      const res = await r.pipeline().set(k, '0', { nx: true, ex }).incr(k).exec()
      return Number(res[1])
    },
    hget: async (k, f) => str(await r.hget(k, f)),
    hset: async (k, f, v) => void (await r.hset(k, { [f]: v })),
    hdel: async (k, f) => void (await r.hdel(k, f)),
    hgetall: async (k) => {
      const o = (await r.hgetall(k)) as Record<string, unknown> | null
      const out: Record<string, string> = {}
      for (const [f, v] of Object.entries(o ?? {})) out[f] = str(v) ?? ''
      return out
    },
    hlen: async (k) => Number(await r.hlen(k)),
    rpush: async (k, v) => Number(await r.rpush(k, v)),
    lrange: async (k, a, b) => ((await r.lrange(k, a, b)) as unknown[]).map((v) => str(v) ?? ''),
    ltrim: async (k, a, b) => void (await r.ltrim(k, a, b)),
  }
}

// ---------- fallback lokal (hanya dev) ----------
type Entry = { v: string | string[] | Record<string, string>; exp?: number }

function fileKV(file: string): KV {
  let db: Record<string, Entry> | null = null
  let chain: Promise<unknown> = Promise.resolve()

  async function load() {
    if (db) return db
    try {
      db = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, Entry>
    } catch {
      db = {}
    }
    return db
  }
  async function save() {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(db, null, 1))
  }
  function live(d: Record<string, Entry>, k: string) {
    const e = d[k]
    if (e && e.exp && e.exp <= Date.now()) {
      delete d[k]
      return undefined
    }
    return e
  }
  // Semua operasi diserialkan supaya tidak ada race baca-tulis file.
  function op<T>(fn: (d: Record<string, Entry>) => T, write = false): Promise<T> {
    const p = chain.then(async () => {
      const d = await load()
      const out = fn(d)
      if (write) await save()
      return out
    })
    chain = p.catch(() => {})
    return p
  }
  const hash = (d: Record<string, Entry>, k: string) => {
    const e = live(d, k)
    if (!e) return (d[k] = { v: {} }).v as Record<string, string>
    return e.v as Record<string, string>
  }
  const list = (d: Record<string, Entry>, k: string) => {
    const e = live(d, k)
    if (!e) return (d[k] = { v: [] }).v as string[]
    return e.v as string[]
  }
  const idx = (n: number, len: number) => (n < 0 ? Math.max(0, len + n) : Math.min(n, len - 1))

  return {
    get: (k) => op((d) => (live(d, k)?.v as string | undefined) ?? null),
    set: (k, v, ex) => op((d) => void (d[k] = { v, exp: ex ? Date.now() + ex * 1000 : undefined }), true),
    setnx: (k, v) =>
      op((d) => {
        if (live(d, k)) return false
        d[k] = { v }
        return true
      }, true),
    del: (k) => op((d) => void delete d[k], true),
    incr: (k, ex) =>
      op((d) => {
        const e = live(d, k)
        const n = (e ? Number(e.v) : 0) + 1
        d[k] = { v: String(n), exp: e ? e.exp : ex ? Date.now() + ex * 1000 : undefined }
        return n
      }, true),
    hget: (k, f) => op((d) => (live(d, k)?.v as Record<string, string> | undefined)?.[f] ?? null),
    hset: (k, f, v) => op((d) => void (hash(d, k)[f] = v), true),
    hdel: (k, f) => op((d) => void delete hash(d, k)[f], true),
    hgetall: (k) => op((d) => ({ ...((live(d, k)?.v as Record<string, string> | undefined) ?? {}) })),
    hlen: (k) => op((d) => Object.keys((live(d, k)?.v as Record<string, string> | undefined) ?? {}).length),
    rpush: (k, v) => op((d) => list(d, k).push(v), true),
    lrange: (k, a, b) =>
      op((d) => {
        const l = (live(d, k)?.v as string[] | undefined) ?? []
        if (!l.length) return []
        return l.slice(idx(a, l.length), idx(b, l.length) + 1)
      }),
    ltrim: (k, a, b) =>
      op((d) => {
        const l = list(d, k)
        d[k].v = l.length ? l.slice(idx(a, l.length), idx(b, l.length) + 1) : []
      }, true),
  }
}

let instance: KV | null = null

export function kv(): KV {
  if (instance) return instance
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (url && token) instance = upstash(url, token)
  else if (process.env.VERCEL) throw new Error('Database belum disambungkan: pasang Upstash Redis dari Vercel Marketplace.')
  else instance = fileKV(path.join(process.env.DEV_DATA_DIR || '.data', 'kv.json'))
  return instance
}
