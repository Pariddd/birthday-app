// /api/skor — "Tantang Parid": rekor Lari Cupcake Dilla vs Parid.
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, HttpError } from '../server/http.js'
import { requireRole, other } from '../server/auth.js'
import { notify } from '../server/push.js'

const KEY = 'skor:lari'
const fmt = (n: number) => n.toLocaleString('id-ID')

async function board() {
  const h = await kv().hgetall(KEY)
  const p = (s?: string) => {
    try {
      return s ? (JSON.parse(s) as { best: number; at: number }) : { best: 0, at: 0 }
    } catch {
      return { best: 0, at: 0 }
    }
  }
  return { dilla: p(h.dilla), parid: p(h.parid) }
}

export default route({
  async GET(req) {
    await requireRole(req)
    return json(await board())
  },

  async POST(req) {
    const me = await requireRole(req)
    await rateLimit(req, 'skor', 30, 60)
    const { skor } = await readJson<{ skor?: unknown }>(req, 200)
    if (!Number.isInteger(skor) || (skor as number) < 0 || (skor as number) > 1_000_000) throw new HttpError(400, 'Skor tidak valid')
    const s = skor as number

    const b = await board()
    const mine = b[me]
    const lawan = b[other(me)]
    if (s <= mine.best) return json({ ...b, rekorBaru: false })

    await kv().hset(KEY, me, JSON.stringify({ best: s, at: Date.now() }))
    const nyalip = lawan.best > 0 && mine.best <= lawan.best && s > lawan.best
    if (nyalip) {
      await notify(other(me), {
        title: me === 'dilla' ? 'Rekormu disalip Dilla! 🧁' : 'Parid ngerebut rekornya lagi 🧁',
        body: `${fmt(s)} vs ${fmt(lawan.best)}. Berani balas?`,
        url: '/?buka=lari',
        tag: 'skor',
      })
    }
    return json({ ...b, [me]: { best: s, at: Date.now() }, rekorBaru: true, nyalip })
  },
})
