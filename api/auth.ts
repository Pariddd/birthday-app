// /api/auth — status, buat PIN (Dilla), masuk PIN, masuk admin (Parid), ganti & reset PIN.
import { kv } from '../server/kv.js'
import { route, json, readJson, rateLimit, HttpError } from '../server/http.js'
import { issueToken, requireRole, revokeAll, hashPin, verifyPin, safeEqual, type Role } from '../server/auth.js'
import { notify } from '../server/push.js'
import { config } from '../src/config.js'

const PIN_KEY = 'auth:pin'
const MAX_FAIL = 10
const LOCK_SEC = 3600

const lockKey = (r: Role) => `auth:lock:${r}`
const failKey = (r: Role) => `auth:fail:${r}`

function pinOk(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,8}$/.test(pin)
}

/** PIN yang gampang ditebak orang yang tahu tanggal lahirnya (tanggal lahir ada di website ini!). */
function pinLemah(pin: string) {
  const { tanggal, bulan, tahun } = config.lahir
  const dd = String(tanggal).padStart(2, '0')
  const mm = String(bulan).padStart(2, '0')
  const yy = String(tahun)
  const tebakan = [dd + mm, mm + dd, dd + mm + yy, dd + mm + yy.slice(2), yy + mm + dd, yy, mm + dd + yy]
  const urut = '01234567890'
  const turun = '09876543210'
  return tebakan.includes(pin) || /^(\d)\1+$/.test(pin) || urut.includes(pin) || turun.includes(pin)
}

async function ensureNotLocked(r: Role) {
  if (await kv().get(lockKey(r))) {
    throw new HttpError(423, 'Terlalu banyak salah. Coba lagi sekitar 1 jam lagi ya.', { code: 'locked' })
  }
}

async function failed(r: Role): Promise<never> {
  const n = await kv().incr(failKey(r), LOCK_SEC)
  if (n >= MAX_FAIL) {
    await kv().set(lockKey(r), '1', LOCK_SEC)
    await kv().del(failKey(r))
    await notify('parid', {
      title: r === 'dilla' ? 'PIN Dilla terkunci' : 'Login admin terkunci',
      body: `${MAX_FAIL}x salah berturut-turut. Dikunci 1 jam. Kalau bukan kalian, aman: belum ada yang masuk.`,
      tag: 'keamanan',
    })
    throw new HttpError(423, 'Terlalu banyak salah. Dikunci 1 jam ya.', { code: 'locked' })
  }
  throw new HttpError(401, r === 'dilla' ? `PIN salah. Sisa ${MAX_FAIL - n} percobaan.` : 'Kata sandi salah.', { code: 'wrong' })
}

async function tryRole(req: Request): Promise<Role | null> {
  try {
    return await requireRole(req)
  } catch {
    return null
  }
}

export default route({
  async GET(req) {
    const [pin, lock, role] = await Promise.all([kv().get(PIN_KEY), kv().get(lockKey('dilla')), tryRole(req)])
    return json({ pinSet: !!pin, locked: !!lock, role })
  },

  async POST(req) {
    const body = await readJson<{ action?: string; pin?: unknown; password?: unknown; oldPin?: unknown }>(req)

    switch (body.action) {
      case 'setup': {
        await rateLimit(req, 'auth', 20, 600)
        if (!pinOk(body.pin)) throw new HttpError(400, 'PIN harus 4–8 angka.')
        if (pinLemah(body.pin)) throw new HttpError(400, 'PIN ini gampang ditebak (tanggal lahir / angka urut). Pilih yang lain ya.', { code: 'weak' })
        // setnx: kalau dua orang membuat PIN bersamaan, hanya yang pertama yang menang.
        const ok = await kv().setnx(PIN_KEY, await hashPin(body.pin))
        if (!ok) throw new HttpError(409, 'PIN sudah pernah dibuat. Masuk pakai PIN-mu ya.', { code: 'exists' })
        await notify('parid', {
          title: 'Dilla sudah bikin PIN',
          body: 'Ruang Kita sudah aktif. (Kalau ini bukan Dilla, reset PIN dari mode Parid.)',
          tag: 'keamanan',
          url: '/?buka=kotak',
        })
        return json({ token: await issueToken('dilla'), role: 'dilla' })
      }

      case 'login': {
        await rateLimit(req, 'auth', 20, 600)
        await ensureNotLocked('dilla')
        if (!pinOk(body.pin)) throw new HttpError(400, 'PIN harus 4–8 angka.')
        const stored = await kv().get(PIN_KEY)
        if (!stored) throw new HttpError(404, 'PIN belum dibuat.', { code: 'nopin' })
        if (!(await verifyPin(body.pin, stored))) return await failed('dilla')
        await kv().del(failKey('dilla'))
        return json({ token: await issueToken('dilla'), role: 'dilla' })
      }

      case 'admin': {
        await rateLimit(req, 'auth', 20, 600)
        await ensureNotLocked('parid')
        const pass = process.env.ADMIN_PASSWORD || (process.env.VERCEL ? '' : 'parid-dev')
        if (pass.length < 8) throw new HttpError(503, 'ADMIN_PASSWORD belum diisi di Vercel (minimal 8 karakter).')
        if (typeof body.password !== 'string' || !safeEqual(body.password, pass)) return await failed('parid')
        await kv().del(failKey('parid'))
        return json({ token: await issueToken('parid'), role: 'parid' })
      }

      case 'changePin': {
        await requireRole(req, 'dilla')
        await rateLimit(req, 'auth', 20, 600)
        await ensureNotLocked('dilla')
        if (!pinOk(body.pin)) throw new HttpError(400, 'PIN baru harus 4–8 angka.')
        if (pinLemah(body.pin)) throw new HttpError(400, 'PIN ini gampang ditebak (tanggal lahir / angka urut). Pilih yang lain ya.', { code: 'weak' })
        const stored = await kv().get(PIN_KEY)
        if (!stored || typeof body.oldPin !== 'string' || !(await verifyPin(body.oldPin, stored))) return await failed('dilla')
        await kv().set(PIN_KEY, await hashPin(body.pin))
        await kv().del(failKey('dilla'))
        await revokeAll('dilla') // perangkat lain yang masih login ikut keluar
        return json({ token: await issueToken('dilla'), role: 'dilla' })
      }

      case 'resetPin': {
        await requireRole(req, 'parid')
        await Promise.all([kv().del(PIN_KEY), kv().del(lockKey('dilla')), kv().del(failKey('dilla'))])
        await revokeAll('dilla')
        return json({ ok: true })
      }

      default:
        throw new HttpError(400, 'Aksi tidak dikenal')
    }
  },
})
