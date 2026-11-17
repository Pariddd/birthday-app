// Penyimpanan file foto album.
// - Produksi: Vercel Blob dengan akses PRIVATE (URL blob tidak bisa dibuka tanpa token),
//   foto hanya bisa dilihat lewat /api/foto yang memeriksa token.
// - Lokal: folder .data/blob/.
import { put, get, del } from '@vercel/blob'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type BlobGet =
  | { status: 200; body: ReadableStream<Uint8Array> | Uint8Array; contentType: string; etag: string }
  | { status: 304; etag: string }

export interface BlobStore {
  put(pathname: string, data: Uint8Array, contentType: string): Promise<void>
  get(pathname: string, ifNoneMatch?: string): Promise<BlobGet | null>
  del(pathname: string): Promise<void>
}

const vercelBlob: BlobStore = {
  async put(pathname, data, contentType) {
    await put(pathname, Buffer.from(data), {
      access: 'private',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    })
  },
  async get(pathname, ifNoneMatch) {
    const r = await get(pathname, { access: 'private', ifNoneMatch })
    if (!r) return null
    if (r.statusCode === 304) return { status: 304, etag: r.blob.etag }
    return { status: 200, body: r.stream, contentType: r.blob.contentType, etag: r.blob.etag }
  },
  async del(pathname) {
    await del(pathname)
  },
}

function fsBlob(dir: string): BlobStore {
  const safe = (p: string) => {
    const full = path.resolve(dir, p)
    if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('path tidak valid')
    return full
  }
  return {
    async put(pathname, data, contentType) {
      const f = safe(pathname)
      await fs.mkdir(path.dirname(f), { recursive: true })
      await fs.writeFile(f, data, { flag: 'wx' })
      await fs.writeFile(f + '.type', contentType)
    },
    async get(pathname, ifNoneMatch) {
      const f = safe(pathname)
      try {
        const st = await fs.stat(f)
        const etag = `"${st.size}-${st.mtimeMs}"`
        if (ifNoneMatch === etag) return { status: 304, etag }
        const [body, type] = await Promise.all([fs.readFile(f), fs.readFile(f + '.type', 'utf8')])
        return { status: 200, body: new Uint8Array(body), contentType: type, etag }
      } catch {
        return null
      }
    },
    async del(pathname) {
      const f = safe(pathname)
      await fs.rm(f, { force: true })
      await fs.rm(f + '.type', { force: true })
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
