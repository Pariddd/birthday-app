// /api/foto?k=album|pesan&id=…&t=… — menyajikan foto dari Blob PRIVATE, hanya dengan token lihat yang valid.
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
    // Token mengikat folder + id: token foto album tidak bisa dipakai membuka foto lain.
    if (!checkView(path, url.searchParams.get('t'))) throw new HttpError(403, 'Tidak boleh')
    const r = await blob().get(path, req.headers.get('if-none-match') ?? undefined)
    if (!r) throw new HttpError(404, 'Foto tidak ditemukan')
    const headers: Record<string, string> = {
      etag: r.etag,
      // private = jangan disimpan cache bersama/CDN; foto dengan id sama tidak pernah berubah.
      'cache-control': 'private, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
    }
    if (r.status === 304) return new Response(null, { status: 304, headers })
    return new Response(r.body as ConstructorParameters<typeof Response>[0], { status: 200, headers: { ...headers, 'content-type': r.contentType } })
  },
})
