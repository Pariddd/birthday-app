// Streak "Taman Kita": tanaman tumbuh di hari ketika Dilla DAN Farid sama-sama mengirim sesuatu
// (surat, foto, album, kapsul). Semua dihitung ulang dari riwayat harian, jadi tidak ada angka
// yang bisa "nyangkut" salah; pelindung (freeze) dipakai otomatis untuk hari yang terlewat.
import { kv } from './kv.js'
import { notify } from './push.js'
import type { Role } from './auth.js'

const KEY = 'streak:hari' // hash: 'YYYY-MM-DD' (WIB) → 'd' | 'p' | 'dp'
const FREEZE_TIAP = 7
const FREEZE_MAKS = 2

export const TAHAP = [
  { min: 0, nama: 'Tanah kosong' },
  { min: 1, nama: 'Biji' },
  { min: 3, nama: 'Tunas' },
  { min: 7, nama: 'Kuncup' },
  { min: 14, nama: 'Mekar' },
  { min: 30, nama: 'Semak bunga' },
  { min: 60, nama: 'Pohon berbunga' },
  { min: 100, nama: 'Pohon legendaris' },
] as const

export const tahapDari = (n: number) => TAHAP.reduce((t, x, i) => (n >= x.min ? i : t), 0)

/** Tanggal WIB (UTC+7) sebagai 'YYYY-MM-DD'. */
export const hariWIB = (ms = Date.now()) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)
const besok = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') + 86400_000).toISOString().slice(0, 10)
const kode = (r: Role) => (r === 'dilla' ? 'd' : 'p')

export type Hitung = { streak: number; best: number; freezes: number; frozen: string[]; hariIni: { dilla: boolean; parid: boolean } }

export function hitung(map: Record<string, string>, today = hariWIB()): Hitung {
  const v = map[today] ?? ''
  const hariIni = { dilla: v.includes('d'), parid: v.includes('p') }
  const dates = Object.keys(map).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  let streak = 0
  let best = 0
  let freezes = 0
  const frozen: string[] = []
  if (!dates.length) return { streak, best, freezes, frozen, hariIni }
  for (let d = dates[0]; d <= today; d = besok(d)) {
    const x = map[d] ?? ''
    if (x.includes('d') && x.includes('p')) {
      streak++
      best = Math.max(best, streak)
      if (streak % FREEZE_TIAP === 0) freezes = Math.min(FREEZE_MAKS, freezes + 1)
    } else if (d === today) {
      // hari ini belum lengkap: streak belum putus, masih ada waktu sampai 23:59 WIB
    } else if (streak > 0 && freezes > 0) {
      freezes--
      frozen.push(d)
    } else {
      streak = 0
      freezes = 0
    }
  }
  return { streak, best, freezes, frozen, hariIni }
}

export async function riwayat() {
  return kv().hgetall(KEY)
}

const nama = (r: Role, n: { dilla: string; parid: string }) => n[r]

/**
 * Catat bahwa `role` "menyiram" hari ini. Dipanggil dari endpoint yang mengirim sesuatu.
 * Tidak pernah melempar error (streak tidak boleh menggagalkan pengiriman surat/foto).
 */
export async function siram(role: Role, namaPeran: { dilla: string; parid: string }) {
  try {
    const today = hariWIB()
    const cur = (await kv().hget(KEY, today)) ?? ''
    if (cur.includes(kode(role))) return
    const next = [...new Set((cur + kode(role)).split(''))].sort().join('') // 'd' | 'p' | 'dp'
    await kv().hset(KEY, today, next)
    if (next !== 'dp') return

    // Hari ini lengkap → kabari yang menyiram duluan, dan rayakan kalau tanamannya naik tahap.
    const h = hitung(await riwayat(), today)
    const naik = tahapDari(h.streak) > tahapDari(h.streak - 1)
    const lain: Role = role === 'dilla' ? 'parid' : 'dilla'
    if (naik) {
      const t = TAHAP[tahapDari(h.streak)]
      const pesan = { title: `Taman Kita naik jadi ${t.nama}! 🌸`, body: `${h.streak} hari berturut-turut. Makin lama makin cantik.`, url: '/?buka=taman', tag: 'streak' }
      await Promise.all([notify('dilla', pesan), notify('parid', pesan)])
    } else {
      await notify(lain, {
        title: `${nama(role, namaPeran)} juga sudah menyiram 💧`,
        body: `Taman Kita: ${h.streak} hari berturut-turut.`,
        url: '/?buka=taman',
        tag: 'streak',
      })
    }
  } catch (e) {
    console.warn('streak gagal dicatat', e)
  }
}
