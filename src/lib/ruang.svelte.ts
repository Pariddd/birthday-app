// "Ruang Kita": sesi login, panggilan API, sinkron progres ke cloud, dan Web Push.
import { game, type Saved } from './state.svelte'
import { config } from '../config'

export type Role = 'dilla' | 'parid'
const TOKEN_KEY = 'ruang-kita-token'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function readToken(): { token: string; role: Role } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    // Isi token hanya dibaca untuk UI (peran & kedaluwarsa). Keabsahannya selalu dicek server.
    const p = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))) as { r: Role; x: number }
    if (p.x * 1000 < Date.now() || (p.r !== 'dilla' && p.r !== 'parid')) return null
    return { token, role: p.r }
  } catch {
    return null
  }
}

class Sesi {
  token: string | null = null
  role = $state<Role | null>(null)
  unread = $state(0)
  /** Foto profil kedua orang (null = belum pasang, tampil inisial). */
  profil = $state<Record<Role, { src: string; at: number } | null>>({ dilla: null, parid: null })

  constructor() {
    const t = readToken()
    if (t) {
      this.token = t.token
      this.role = t.role
    }
  }

  /** Nama lawan bicara. */
  get lawan() {
    return this.role === 'parid' ? config.nama : config.pengirim
  }

  async login(token: string, role: Role) {
    this.token = token
    this.role = role
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* private mode: login hanya bertahan selama tab terbuka */
    }
    if (role === 'parid') {
      // Perangkat Farid (peran internal 'parid'): buka semua scene tanpa harus melewati alur ultah.
      game.unlocked = true
      game.finished = true
      game.save()
    }
    startSync()
    void refreshProfil()
    if (role === 'dilla') await pullProgres()
  }

  logout() {
    this.token = null
    this.role = null
    this.unread = 0
    this.profil = { dilla: null, parid: null }
    game.afterSave = null
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* abaikan */
    }
  }
}

export const sesi = new Sesi()

type Opts = { method?: string; body?: unknown; raw?: Blob; headers?: Record<string, string>; signal?: AbortSignal }

export async function api<T = Record<string, unknown>>(path: string, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { ...o.headers }
  if (sesi.token) headers.authorization = `Bearer ${sesi.token}`
  let body: BodyInit | undefined
  if (o.raw) body = o.raw
  else if (o.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(o.body)
  }
  // Batas waktu: tanpa ini, server yang tidak menjawab bikin tampilan "sebentar…" selamanya.
  const ctl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctl.abort()
  }, o.raw ? 90_000 : 15_000)
  o.signal?.addEventListener('abort', () => ctl.abort())
  let res: Response
  try {
    res = await fetch(`/api/${path}`, { method: o.method ?? (body ? 'POST' : 'GET'), headers, body, signal: ctl.signal })
  } catch (e) {
    if (timedOut) throw new ApiError(0, 'Server tidak menjawab (lebih dari 15 detik). Coba lagi sebentar ya.', 'timeout')
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Koneksi internetnya lagi putus. Coba lagi ya.')
  } finally {
    clearTimeout(timer)
  }
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    // Bukan JSON: biasanya /api belum ter-deploy (yang terkirim malah halaman HTML) atau error platform.
    if (res.ok) throw new ApiError(res.status, 'Server Ruang Kita belum aktif di deploy ini (/api tidak ditemukan).', 'noapi')
  }
  if (!res.ok) {
    const err = new ApiError(res.status, String(data.error ?? `Server error (${res.status}). Coba lagi ya.`), data.code as string | undefined)
    if (res.status === 401 && err.code === 'auth') sesi.logout()
    throw err
  }
  return data as T
}

// ---------- progres di cloud (khusus Dilla) ----------
let pushTimer: ReturnType<typeof setTimeout> | undefined

function pushProgres() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (sesi.role !== 'dilla') return
    const { muted: _m, ...data } = game.snapshot()
    void _m
    api('progres', { method: 'PUT', body: data }).catch(() => {
      /* offline: dicoba lagi di simpan berikutnya */
    })
  }, 2500)
}

const union = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y)

/** Ambil progres dari cloud lalu gabung dengan yang ada di perangkat ini. */
export async function pullProgres() {
  try {
    const { data } = await api<{ data: (Omit<Saved, 'muted'> & { t: number }) | null }>('progres')
    if (data) {
      const cloudNewer = data.t > game.t
      game.unlocked ||= data.unlocked
      game.finished ||= data.finished
      game.collected = union(game.collected, data.collected)
      game.doa = union(game.doa, data.doa)
      game.secrets = union(game.secrets, data.secrets)
      game.best = Math.max(game.best, data.best)
      game.doaGame ||= data.doaGame
      if (cloudNewer) {
        game.coins = data.coins
        game.cake = { ...game.cake, ...data.cake }
      }
    }
    game.save() // sekaligus kirim hasil gabungan ke cloud
  } catch {
    /* offline: tetap pakai progres lokal */
  }
}

// ---------- foto profil ----------
export async function refreshProfil() {
  if (!sesi.role) return
  try {
    sesi.profil = await api<Record<Role, { src: string; at: number } | null>>('profil')
  } catch {
    /* abaikan: tampil inisial */
  }
}

function startSync() {
  game.afterSave = sesi.role === 'dilla' ? pushProgres : null
}
if (sesi.role) {
  startSync()
  void refreshProfil()
}

// ---------- jumlah surat belum dibaca ----------
// Penanda "sudah dibaca" yang sedang dikirim. Badge di lobi menunggu ini selesai dulu: tanpa itu,
// keluar dari Kotak Surat dengan cepat bisa membuat lobi bertanya ke server SEBELUM penanda tersimpan
// (dua request paralel di Vercel), lalu badge "1 surat baru" muncul lagi padahal sudah dibaca.
let readPending: Promise<unknown> = Promise.resolve()

export function tandaiDibaca(upTo: number) {
  sesi.unread = 0
  void tutupNotif('pesan')
  readPending = api('pesan', { body: { action: 'read', upTo } }).catch(() => {})
  return readPending
}

export async function refreshUnread() {
  if (!sesi.role) return
  try {
    await readPending
    const r = await api<{ unread: number }>('pesan?ringkas=1')
    sesi.unread = r.unread
    if (r.unread === 0) void tutupNotif('pesan')
  } catch {
    /* abaikan */
  }
}

/** Hapus notifikasi HP yang sudah tidak relevan (mis. "surat baru" setelah suratnya dibaca). */
export async function tutupNotif(prefix: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const list = (await reg?.getNotifications()) ?? []
    for (const n of list) if (n.tag?.startsWith(prefix)) n.close()
  } catch {
    /* browser tanpa dukungan: abaikan */
  }
}

// ---------- Web Push ----------
export const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)
export const isStandalone =
  typeof matchMedia !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
export const pushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'server-off'

export async function pushState(): Promise<PushState> {
  if (!pushSupported) return isIOS && !isStandalone ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

function b64ToBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export async function enablePush(): Promise<PushState> {
  const { publicKey } = await api<{ publicKey: string | null }>('push')
  if (!publicKey) return 'server-off'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
  await api('push', { body: { subscription: sub.toJSON() } })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api('push', { body: { action: 'unsubscribe', endpoint: sub.endpoint } }).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}

export function waktu(ms: number) {
  const d = new Date(ms)
  const now = new Date()
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return jam
  const kemarin = new Date(now)
  kemarin.setDate(now.getDate() - 1)
  if (d.toDateString() === kemarin.toDateString()) return `kemarin ${jam}`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ` ${jam}`
}
