// /api/progres — simpan progres Dilla di cloud (pindah HP / hapus cache tidak hilang).
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit } from '../server/http.js'
import { requireRole } from '../server/auth.js'

const KEY = 'progres:dilla'

type Progres = {
  t: number // waktu ubah terakhir (ms) — dipakai untuk field "last write wins"
  scene: string
  unlocked: boolean
  finished: boolean
  cake: Record<string, string>
  coins: number
  collected: number[]
  doa: number[]
  best: number
  doaGame: boolean
  secrets: number[]
}

const ints = (v: unknown, max = 64) =>
  Array.isArray(v) ? [...new Set(v.filter((n) => Number.isInteger(n) && n >= 0 && n < 1000) as number[])].slice(0, max) : []
const union = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y)

function clean(v: Record<string, unknown>): Progres {
  const cake: Record<string, string> = {}
  if (v.cake && typeof v.cake === 'object') {
    for (const [k, c] of Object.entries(v.cake as Record<string, unknown>).slice(0, 10)) {
      if (/^[a-z]{1,12}$/.test(k) && typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) cake[k] = c
    }
  }
  return {
    t: Number.isFinite(v.t) ? Math.min(Number(v.t), Date.now() + 60_000) : 0,
    scene: typeof v.scene === 'string' && /^[a-z]{2,20}$/.test(v.scene) ? v.scene : 'arcade',
    unlocked: !!v.unlocked,
    finished: !!v.finished,
    cake,
    coins: Number.isInteger(v.coins) ? Math.max(0, Math.min(Number(v.coins), 9999)) : 0,
    collected: ints(v.collected),
    doa: ints(v.doa),
    best: Number.isInteger(v.best) ? Math.max(0, Math.min(Number(v.best), 10_000_000)) : 0,
    doaGame: !!v.doaGame,
    secrets: ints(v.secrets, 10),
  }
}

/** Gabung dua progres: koleksi = gabungan, rekor = maksimum, sisanya ikut yang paling baru. */
function merge(a: Progres, b: Progres): Progres {
  const [old, neu] = a.t <= b.t ? [a, b] : [b, a]
  return {
    ...neu,
    unlocked: a.unlocked || b.unlocked,
    finished: a.finished || b.finished,
    collected: union(a.collected, b.collected),
    doa: union(a.doa, b.doa),
    secrets: union(a.secrets, b.secrets),
    best: Math.max(a.best, b.best),
    doaGame: a.doaGame || b.doaGame,
    cake: { ...old.cake, ...neu.cake },
  }
}

async function load(): Promise<Progres | null> {
  const raw = await kv().get(KEY)
  if (!raw) return null
  try {
    return clean(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return null
  }
}

export default route({
  async GET(req) {
    await requireRole(req, 'dilla')
    return json({ data: await load() })
  },
  async PUT(req) {
    await requireRole(req, 'dilla')
    await rateLimit(req, 'progres', 30, 60)
    const incoming = clean(await readJson(req, 8000))
    const cur = await load()
    const merged = cur ? merge(cur, incoming) : incoming
    await kv().set(KEY, JSON.stringify(merged))
    return json({ data: merged })
  },
})
