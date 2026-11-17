// /api/foto?k=album|pesan|profil|video&id=…&t=… — menyajikan file dari Blob PRIVATE, hanya dengan token lihat yang valid.
import { blob } from '../server/blob.js'
import { route, HttpError } from '../server/http.js'
import { checkView } from '../server/auth.js'
import { ID_RE, FOLDERS, blobPath, type Folder } from '../server/gambar.js'

export default route({
  async GET(req, url) {
    const id = url.searchParams.get('id') || ''
    const k = (url.searchParams.get('k') || 'album') as Folder
    if (!FOLDERS.includes(k) || !ID_RE.test(id)) throw new HttpError(400, 'Tidak valid')
    const path = blobPath(k, id)
    // Token mengikat folder + id: token foto album tidak bisa dipakai membuka file lain.
    if (!checkView(path, url.searchParams.get('t'))) throw new HttpError(403, 'Tidak boleh')

    // Video: arahkan browser ke URL presigned sementara di CDN Blob (mendukung Range & seek,
    // tidak membebani fungsi). Kalau tidak tersedia, fallback ke streaming lewat fungsi di bawah.
    if (k === 'video' && blob().remote) {
      const presigned = await blob().presignGet(path, Date.now() + 2 * 3600_000)
      if (presigned) return new Response(null, { status: 302, headers: { location: presigned, 'cache-control': 'private, max-age=3000' } })
    }

    const r = await blob().get(path, { ifNoneMatch: req.headers.get('if-none-match') ?? undefined, range: req.headers.get('range') ?? undefined })
    if (!r) throw new HttpError(404, 'File tidak ditemukan')
    if (r.status === 416) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${r.size}` } })
    const headers: Record<string, string> = {
      etag: r.etag,
      // private = jangan disimpan cache bersama/CDN; file dengan id sama tidak pernah berubah.
      'cache-control': 'private, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
    }
    if (r.status === 304) return new Response(null, { status: 304, headers })
    return new Response(r.body as ConstructorParameters<typeof Response>[0], { status: r.status, headers: { ...headers, ...r.extra, 'content-type': r.contentType } })
  },
})
