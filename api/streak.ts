// /api/streak — status "Taman Kita" (streak siram berdua).
import { route, json, HttpError } from '../server/http.js'
import { requireRole, safeEqual, ROLES } from '../server/auth.js'
import { notify } from '../server/push.js'
import { riwayat, hitung, hariWIB, tahapDari, TAHAP } from '../server/streak.js'
import { config } from '../src/config.js'

const HARI_KALENDER = 14

// Cron 20:05 WIB: pengingat lembut untuk yang belum menyiram, hanya kalau streak sedang berjalan.
async function cron(req: Request) {
  const s = process.env.CRON_SECRET
  if (!s || !safeEqual(req.headers.get('authorization') || '', `Bearer ${s}`)) throw new HttpError(401, 'unauthorized')
  const h = hitung(await riwayat())
  if (h.streak === 0) return json({ skip: 'belum ada streak' })
  const terkirim: string[] = []
  for (const r of ROLES) {
    if (h.hariIni[r]) continue
    const lain = r === 'dilla' ? config.pengirim : config.nama
    const sudahLain = h.hariIni[r === 'dilla' ? 'parid' : 'dilla']
    await notify(r, {
      title: 'Taman Kita belum disiram hari ini 🌱',
      body: sudahLain ? `${lain} sudah menyiram. Kirim apa aja biar ${h.streak} harinya lanjut.` : `Kirim surat atau foto apa aja, biar ${h.streak} harinya lanjut.`,
      url: '/?buka=kotak',
      tag: 'streak',
    })
    terkirim.push(r)
  }
  return json({ ok: true, terkirim })
}

export default route({
  async GET(req, url) {
    if (url.searchParams.has('cron')) return cron(req)
    await requireRole(req)
    const map = await riwayat()
    const today = hariWIB()
    const h = hitung(map, today)
    const t = tahapDari(h.streak)
    const kal: { tgl: string; d: boolean; p: boolean; beku: boolean }[] = []
    for (let i = HARI_KALENDER - 1; i >= 0; i--) {
      const tgl = hariWIB(Date.now() - i * 86400_000)
      const v = map[tgl] ?? ''
      kal.push({ tgl, d: v.includes('d'), p: v.includes('p'), beku: h.frozen.includes(tgl) })
    }
    return json({
      ...h,
      frozen: undefined,
      hariIniTgl: today,
      tahap: t,
      namaTahap: TAHAP[t].nama,
      berikut: TAHAP[t + 1] ? { nama: TAHAP[t + 1].nama, sisa: TAHAP[t + 1].min - h.streak } : null,
      tahapList: TAHAP.map((x) => ({ nama: x.nama, min: x.min })),
      kalender: kal,
    })
  },
})
