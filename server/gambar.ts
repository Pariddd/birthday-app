// Foto yang diunggah (album & kotak surat): validasi isi file + URL lihat bertoken.
import { randomBytes } from 'node:crypto'
import { HttpError } from './http.js'
import { viewToken } from './auth.js'

export const MAX_BYTES = 4 * 1024 * 1024 // batas body Vercel Function 4,5 MB
export const ID_RE = /^[a-z0-9]{10,24}$/
export type Folder = 'album' | 'pesan' | 'profil'
export const FOLDERS: Folder[] = ['album', 'pesan', 'profil']

export const newId = () => Date.now().toString(36) + randomBytes(5).toString('hex')
/** Tanpa ekstensi: tipe file disimpan sebagai content-type blob. */
export const blobPath = (folder: Folder, id: string) => `${folder}/${id}`

/** URL foto untuk <img>. Token hanya berlaku untuk SATU file ini. */
export const fotoSrc = (folder: Folder, id: string) => `/api/foto?k=${folder}&id=${id}&t=${viewToken(blobPath(folder, id))}`

/** Cek "magic bytes": isi file harus benar-benar gambar, bukan cuma ngaku-ngaku lewat header. */
export function sniff(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png'
  const ascii = (s: number, e: number) => String.fromCharCode(...b.subarray(s, e))
  if (b.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Baca body request sebagai gambar (maks 4 MB) + dimensi dari header x-w / x-h. */
export async function readImage(req: Request) {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BYTES) throw new HttpError(413, 'Fotonya kebesaran (maks 4 MB).')
  const data = new Uint8Array(await req.arrayBuffer())
  if (!data.length) throw new HttpError(400, 'Fotonya kosong')
  if (data.length > MAX_BYTES) throw new HttpError(413, 'Fotonya kebesaran (maks 4 MB).')
  const type = sniff(data)
  if (!type) throw new HttpError(415, 'Itu bukan foto JPG/PNG/WEBP.')
  const dim = (h: string) => Math.max(0, Math.min(10000, Math.floor(Number(req.headers.get(h)) || 0)))
  return { data, type, w: dim('x-w'), h: dim('x-h') }
}

/** Teks di header (di-encodeURIComponent oleh browser supaya emoji aman). */
export function headerText(req: Request, name: string) {
  try {
    return decodeURIComponent(req.headers.get(name) || '')
  } catch {
    throw new HttpError(400, 'Teks tidak valid')
  }
}
