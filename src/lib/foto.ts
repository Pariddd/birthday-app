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


/**
 * Baca durasi & ukuran video lalu ambil satu frame sebagai poster (JPEG, sisi terpanjang 960 px).
 * Gagal = browser ini tidak bisa memutar format videonya (mis. HEVC di sebagian Android/Chrome).
 */
export function posterVideo(file: File): Promise<{ blob: Blob; w: number; h: number; dur: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = url
    const selesai = (e?: unknown) => {
      URL.revokeObjectURL(url)
      v.removeAttribute('src')
      v.load()
      if (e) reject(e)
    }
    const timer = setTimeout(() => selesai(new Error('timeout')), 15000)
    v.onerror = () => {
      clearTimeout(timer)
      selesai(new Error('format'))
    }
    v.onloadedmetadata = () => {
      // iOS butuh sedikit "dorongan" supaya frame pertama ter-decode.
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3)
    }
    v.onseeked = async () => {
      clearTimeout(timer)
      try {
        const s = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight))
        const w = Math.max(1, Math.round(v.videoWidth * s))
        const h = Math.max(1, Math.round(v.videoHeight * s))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(v, 0, 0, w, h)
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.8))
        const dur = v.duration
        selesai()
        if (!blob) return reject(new Error('poster'))
        resolve({ blob, w: v.videoWidth, h: v.videoHeight, dur })
      } catch (e) {
        selesai(e)
      }
    }
  })
}
