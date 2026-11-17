// /api/foto?id=…&t=… — menyajikan foto album dari Blob PRIVATE, hanya dengan token lihat yang valid.
import { blob } from '../server/blob.js'
import { route, HttpError } from '../server/http.js'
import { checkView } from '../server/auth.js'

const ID_RE = /^[a-z0-9]{10,24}$/

export default route({
  async GET(req, url) {
    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id) || !checkView(id, url.searchParams.get('t'))) throw new HttpError(403, 'Tidak boleh')
    const r = await blob().get(`album/${id}`, req.headers.get('if-none-match') ?? undefined)
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
