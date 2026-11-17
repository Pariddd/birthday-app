// Token bertanda tangan HMAC (tanpa library JWT) + hash PIN scrypt.
// Dua peran: 'dilla' (login pakai PIN buatannya sendiri) dan 'parid' (login pakai ADMIN_PASSWORD).
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { kv } from './kv.js'
import { HttpError } from './http.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>

export type Role = 'dilla' | 'parid'
export const ROLES: Role[] = ['dilla', 'parid']
export const other = (r: Role): Role => (r === 'dilla' ? 'parid' : 'dilla')

const TOKEN_DAYS = 180

function secret(): string {
  const s = process.env.APP_SECRET
  if (s && s.length >= 32) return s
  if (process.env.VERCEL) throw new Error('APP_SECRET belum diisi (minimal 32 karakter).')
  return 'dev-only-secret-jangan-dipakai-di-produksi-0123456789'
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const mac = (data: string, purpose: string) => createHmac('sha256', secret()).update(purpose + '.' + data).digest()

function sign(obj: object, purpose: string) {
  const body = b64(JSON.stringify(obj))
  return `${body}.${b64(mac(body, purpose))}`
}

function unsign<T>(token: string | null | undefined, purpose: string): T | null {
  if (!token || token.length > 600) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = mac(body, purpose)
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

export const safeEqual = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

// ---------- token sesi ----------
type Session = { r: Role; v: string; x: number }

const verKey = (r: Role) => `auth:ver:${r}`

export async function issueToken(role: Role) {
  const v = (await kv().get(verKey(role))) ?? '0'
  return sign({ r: role, v, x: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 } satisfies Session, 'sess')
}

/** Cabut semua token lama milik peran ini (mis. saat PIN di-reset). */
export async function revokeAll(role: Role) {
  await kv().incr(verKey(role))
}

/** Ambil peran dari header Authorization. Lempar 401 kalau tidak valid. */
export async function requireRole(req: Request, ...allowed: Role[]): Promise<Role> {
  const h = req.headers.get('authorization') || ''
  const s = unsign<Session>(h.startsWith('Bearer ') ? h.slice(7) : null, 'sess')
  if (!s || !ROLES.includes(s.r) || s.x * 1000 < Date.now()) throw new HttpError(401, 'Sesi habis, masuk lagi ya.', { code: 'auth' })
  const v = (await kv().get(verKey(s.r))) ?? '0'
  if (v !== s.v) throw new HttpError(401, 'Sesi habis, masuk lagi ya.', { code: 'auth' })
  if (allowed.length && !allowed.includes(s.r)) throw new HttpError(403, 'Bagian ini bukan buat kamu.')
  return s.r
}

// ---------- token lihat foto ----------
// <img src> tidak bisa mengirim header Authorization, jadi tiap URL foto membawa token pendek
// yang hanya berlaku untuk SATU foto. Kedaluwarsa dibulatkan per hari supaya URL stabil
// seharian (cache browser tetap kepakai).
const DAY = 86400

export function viewToken(id: string) {
  const x = (Math.floor(Date.now() / 1000 / DAY) + 2) * DAY
  return sign({ f: id, x }, 'view')
}

export function checkView(id: string, token: string | null) {
  const t = unsign<{ f: string; x: number }>(token, 'view')
  return !!t && t.f === id && t.x * 1000 > Date.now()
}

// ---------- PIN ----------
const SCRYPT = { N: 16384, r: 8, p: 1 }

export async function hashPin(pin: string) {
  const salt = randomBytes(16)
  const h = await scrypt(pin, salt, 32, SCRYPT)
  return JSON.stringify({ s: salt.toString('hex'), h: h.toString('hex') })
}

export async function verifyPin(pin: string, stored: string) {
  try {
    const { s, h } = JSON.parse(stored) as { s: string; h: string }
    const got = await scrypt(pin, Buffer.from(s, 'hex'), 32, SCRYPT)
    const want = Buffer.from(h, 'hex')
    return got.length === want.length && timingSafeEqual(got, want)
  } catch {
    return false
  }
}
