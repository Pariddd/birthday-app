// Penyimpanan file (foto & video album, foto chat, foto profil).
// - Produksi: Vercel Blob dengan akses PRIVATE (URL blob tidak bisa dibuka tanpa token),
//   file hanya bisa dilihat lewat /api/foto yang memeriksa token.
// - Lokal: folder .data/blob/.
import { put, get, del, head, issueSignedToken, presignUrl } from '@vercel/blob'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type BlobGet =
  | {
      status: 200 | 206
      body: ReadableStream<Uint8Array> | Uint8Array
      contentType: string
      etag: string
      /** header tambahan untuk respons (content-range, content-length, accept-ranges) */
      extra: Record<string, string>
    }
  | { status: 304; etag: string }
  | { status: 416; size: number }

export interface BlobStore {
  /** true = Vercel Blob sungguhan (bisa upload langsung dari browser & URL presigned). */
  readonly remote: boolean
  put(pathname: string, data: Uint8Array, contentType: string): Promise<void>
  get(pathname: string, opts?: { ifNoneMatch?: string; range?: string }): Promise<BlobGet | null>
  head(pathname: string): Promise<{ size: number; contentType: string } | null>
  del(pathname: string): Promise<void>
  /** URL baca sementara langsung ke CDN Blob (mendukung Range untuk video). null = tidak tersedia. */
  presignGet(pathname: string, validUntil: number): Promise<string | null>
}

const pick = (h: { get(name: string): string | null }, keys: string[]) => {
  const o: Record<string, string> = {}
  for (const k of keys) {
    const v = h.get(k)
    if (v) o[k] = v
  }
  return o
}

const vercelBlob: BlobStore = {
  remote: true,
  async put(pathname, data, contentType) {
    await put(pathname, Buffer.from(data), {
      access: 'private',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    })
  },
  async get(pathname, opts = {}) {
    const r = await get(pathname, { access: 'private', ifNoneMatch: opts.ifNoneMatch, headers: opts.range ? { range: opts.range } : undefined })
    if (!r) return null
    if (r.statusCode === 304) return { status: 304, etag: r.blob.etag }
    const extra = pick(r.headers, ['content-range', 'content-length', 'accept-ranges'])
    return { status: extra['content-range'] ? 206 : 200, body: r.stream, contentType: r.blob.contentType, etag: r.blob.etag, extra }
  },
  async head(pathname) {
    try {
      const h = await head(pathname)
      return { size: h.size, contentType: h.contentType }
    } catch {
      return null
    }
  },
  async del(pathname) {
    await del(pathname)
  },
  async presignGet(pathname, validUntil) {
    try {
      const token = await issueSignedToken({ pathname, operations: ['get', 'head'], validUntil })
      const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil })
      return presignedUrl
    } catch (e) {
      console.warn('presign gagal, pakai proxy', e)
      return null
    }
  },
}

function fsBlob(dir: string): BlobStore {
  const safe = (p: string) => {
    const full = path.resolve(dir, p)
    if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('path tidak valid')
    return full
  }
  return {
    remote: false,
    async put(pathname, data, contentType) {
      const f = safe(pathname)
      await fs.mkdir(path.dirname(f), { recursive: true })
      await fs.writeFile(f, data, { flag: 'wx' })
      await fs.writeFile(f + '.type', contentType)
    },
    async get(pathname, opts = {}): Promise<BlobGet | null> {
      const f = safe(pathname)
      try {
        const st = await fs.stat(f)
        const etag = `"${st.size}-${st.mtimeMs}"`
        if (opts.ifNoneMatch === etag && !opts.range) return { status: 304, etag }
        const [buf, type] = await Promise.all([fs.readFile(f), fs.readFile(f + '.type', 'utf8')])
        const m = opts.range?.match(/^bytes=(\d*)-(\d*)$/)
        if (m) {
          let a = m[1] ? Number(m[1]) : st.size - Number(m[2])
          let b = m[1] && m[2] ? Number(m[2]) : st.size - 1
          a = Math.max(0, a)
          b = Math.min(st.size - 1, b)
          if (a > b) return { status: 416, size: st.size }
          return {
            status: 206,
            body: new Uint8Array(buf.subarray(a, b + 1)),
            contentType: type,
            etag,
            extra: { 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': String(b - a + 1), 'accept-ranges': 'bytes' },
          }
        }
        return { status: 200, body: new Uint8Array(buf), contentType: type, etag, extra: { 'content-length': String(st.size), 'accept-ranges': 'bytes' } }
      } catch {
        return null
      }
    },
    async head(pathname) {
      try {
        const f = safe(pathname)
        const [st, type] = await Promise.all([fs.stat(f), fs.readFile(f + '.type', 'utf8')])
        return { size: st.size, contentType: type }
      } catch {
        return null
      }
    },
    async del(pathname) {
      const f = safe(pathname)
      await fs.rm(f, { force: true })
      await fs.rm(f + '.type', { force: true })
    },
    async presignGet() {
      return null
    },
  }
}

let instance: BlobStore | null = null

export function blob(): BlobStore {
  if (instance) return instance
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) instance = vercelBlob
  else if (process.env.VERCEL) throw new Error('Penyimpanan foto belum disambungkan: buat Blob store (Private) di Vercel → Storage.')
  else instance = fsBlob(path.join(process.env.DEV_DATA_DIR || '.data', 'blob'))
  return instance
}
