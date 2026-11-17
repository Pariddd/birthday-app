// Kecilkan foto di HP sebelum diunggah: sisi terpanjang 1600 px, JPEG.
// Hemat kuota Blob & data seluler, dan selalu di bawah batas 4 MB fungsi Vercel.
const MAX_SIDE = 1600

export async function kompres(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file) // orientasi EXIF ikut diterapkan (default 'from-image')
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * s)
  const h = Math.round(bmp.height * s)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff' // PNG transparan → latar putih, bukan hitam
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q))
    if (blob && blob.size < 3.8 * 1024 * 1024) return { blob, w, h }
  }
  throw new Error('Fotonya terlalu besar')
}
