<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { config } from '../config'
  import { sfx } from '../lib/audio'
  import { burst } from '../lib/fx'
  import Icon from './Icon.svelte'

  // Poster wallpaper 9:16 dari 8 foto, digambar di canvas langsung di HP (tanpa server).
  let { onclose, celebrate = false }: { onclose: () => void; celebrate?: boolean } = $props()

  const W = 1080
  const H = 1920
  let url = $state('')
  let blob: Blob | null = null
  let failed = $state(false)
  const fileName = `rekap-kenangan-${config.nama.toLowerCase()}.png`
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare

  const fotos = config.foto as ((typeof config.foto)[number] & { legendary?: boolean })[]
  // Umur yang sedang DIRAYAKAN (WIB): ulang tahun terakhir, kecuali ulang tahun berikutnya
  // tinggal ≤ 30 hari lagi — supaya poster tetap "21" walau dibuka/dites sehari sebelumnya.
  const umur = (() => {
    const now = Date.now()
    const ultah = (y: number) => Date.UTC(y, config.lahir.bulan - 1, config.lahir.tanggal) - 7 * 3600_000
    const y = new Date(now + 7 * 3600_000).getUTCFullYear()
    const terakhir = ultah(y) <= now ? y : y - 1
    const berikut = terakhir + 1
    const tahunDirayakan = ultah(berikut) - now <= 30 * 86_400_000 ? berikut : terakhir
    return tahunDirayakan - config.lahir.tahun
  })()
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const tanggal = `${config.lahir.tanggal} ${BULAN[config.lahir.bulan - 1]} ${config.lahir.tahun + umur}`

  function loadImg(src: string): Promise<HTMLImageElement | null> {
    return new Promise((res) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => res(null)
      im.src = src
    })
  }

  function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    const p = new Path2D('M12 2 C12.6 8 14 10.6 22 12 C14 13.4 12.6 16 12 22 C11.4 16 10 13.4 2 12 C10 10.6 11.4 8 12 2Z')
    ctx.translate(-12, -12)
    ctx.fillStyle = fill
    ctx.fill(p)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = '#23408E'
    ctx.stroke(p)
    ctx.restore()
  }

  function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.translate(-20, -20)
    const p = new Path2D('M4 14 C4 4 16 0 20 10 C24 0 36 4 36 14 C36 28 20 38 20 38 C20 38 4 28 4 14 Z')
    ctx.fillStyle = fill
    ctx.fill(p)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#23408E'
    ctx.stroke(p)
    ctx.restore()
  }

  async function render() {
    await Promise.all([document.fonts.load('700 80px Caveat'), document.fonts.load('800 40px Nunito')]).catch(() => {})
    const imgs = await Promise.all(fotos.map((f) => loadImg(f.src)))
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!

    // kertas bergaris
    ctx.fillStyle = '#FBF8F1'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#DCE5F3'
    ctx.lineWidth = 3
    for (let y = 64; y < H; y += 64) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.strokeStyle = '#F2B8C6'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(84, 0)
    ctx.lineTo(84, H)
    ctx.stroke()

    // judul
    ctx.textAlign = 'center'
    ctx.fillStyle = '#C93D66'
    ctx.font = '700 72px Caveat, cursive'
    ctx.fillText('rekap kenangan', W / 2, 150)
    ctx.fillStyle = '#23408E'
    ctx.font = '700 170px Caveat, cursive'
    ctx.fillText(`${config.nama}, ${umur}`, W / 2, 310)
    ctx.font = '800 40px Nunito, sans-serif'
    ctx.fillStyle = '#3B4566'
    ctx.fillText(tanggal, W / 2, 380)

    // polaroid 3-3-2
    const pos: [number, number][] = [
      [230, 610], [540, 590], [850, 615],
      [230, 1010], [540, 990], [850, 1015],
      [385, 1400], [695, 1395],
    ]
    const rot = [-5, 3, -3, 4, -2, 5, -4, 3]
    const PW = 290
    const PH = 360
    const IW = 254
    const IH = 290
    fotos.forEach((f, i) => {
      const [x, y] = pos[i] ?? pos[pos.length - 1]
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((rot[i] * Math.PI) / 180)
      // bayangan pink
      ctx.fillStyle = f.legendary ? '#F6D58E' : '#FBD3DE'
      ctx.fillRect(-PW / 2 + 12, -PH / 2 + 12, PW, PH)
      // bingkai
      ctx.fillStyle = f.legendary ? '#FFF4CC' : '#FFFFFF'
      ctx.fillRect(-PW / 2, -PH / 2, PW, PH)
      ctx.lineWidth = 5
      ctx.strokeStyle = f.legendary ? '#B98A2A' : '#23408E'
      ctx.strokeRect(-PW / 2, -PH / 2, PW, PH)
      // foto (object-fit: cover)
      const ix = -IW / 2
      const iy = -PH / 2 + 18
      const im = imgs[i]
      if (im) {
        const r = IW / IH
        let sw = im.naturalWidth
        let sh = sw / r
        if (sh > im.naturalHeight) {
          sh = im.naturalHeight
          sw = sh * r
        }
        ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, ix, iy, IW, IH)
      } else {
        ctx.fillStyle = '#EEF3FB'
        ctx.fillRect(ix, iy, IW, IH)
      }
      ctx.lineWidth = 3
      ctx.strokeStyle = '#23408E'
      ctx.strokeRect(ix, iy, IW, IH)
      // nomor
      ctx.fillStyle = '#23408E'
      ctx.font = '700 40px Caveat, cursive'
      ctx.textAlign = 'center'
      ctx.fillText(f.legendary ? '★ legendary' : `#${i + 1}`, 0, PH / 2 - 16)
      // selotip
      ctx.rotate(((i % 2 ? 6 : -6) * Math.PI) / 180)
      ctx.fillStyle = i % 2 ? 'rgba(142,211,190,0.65)' : 'rgba(242,138,165,0.6)'
      ctx.fillRect(-60, -PH / 2 - 22, 120, 40)
      ctx.restore()
    })

    // stiker
    star(ctx, 150, 200, 3.2, '#F6D58E')
    star(ctx, 960, 170, 2.4, '#9CCBF0')
    heart(ctx, 960, 1330, 2.2, '#F28AA5')
    star(ctx, 160, 1660, 2.2, '#C3B1F0')
    heart(ctx, 120, 820, 1.4, '#FBD3DE')

    // penutup
    ctx.textAlign = 'center'
    ctx.fillStyle = '#C93D66'
    ctx.font = '700 64px Caveat, cursive'
    ctx.fillText(`— dari ${config.pengirim}, juspren dilla`, W / 2, 1760)
    ctx.fillStyle = '#5A6280'
    ctx.font = '600 30px Nunito, sans-serif'
    ctx.fillText('happy birthday! jangan lupa traktirannya', W / 2, 1830)

    blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    if (!blob) {
      failed = true
      return
    }
    url = URL.createObjectURL(blob)
  }

  async function share() {
    if (!blob) return
    const file = new File([blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
    } catch {
      /* dibatalkan */
    }
  }

  onMount(() => {
    if (celebrate) {
      sfx.tada()
      burst({ big: true, y: 0.4 })
    }
    void render()
  })
  onDestroy(() => url && URL.revokeObjectURL(url))
</script>

<div class="back overlay-fixed" transition:fade={{ duration: 200 }}></div>
<div class="sheet overlay-fixed" role="dialog" aria-modal="true" aria-labelledby="rekap-t" transition:fade={{ duration: 250 }}>
  <h2 id="rekap-t" class="hand">{celebrate ? 'Semua kenangan terkumpul!' : 'Rekap Kenangan'}</h2>
  <p class="sub">Simpan jadi wallpaper HP-mu ya.</p>

  <div class="preview">
    {#if url}
      <img src={url} alt="Poster rekap kenangan berisi 8 foto" in:scale={{ start: 0.7, duration: 450 }} />
    {:else if failed}
      <p class="wait">Posternya gagal dibuat di perangkat ini.</p>
    {:else}
      <p class="wait hand">menyusun kenangan…</p>
    {/if}
  </div>

  <div class="actions">
    {#if url}
      <a class="btn pink grow" href={url} download={fileName}><Icon name="download" /> Simpan wallpaper</a>
      {#if canShare}<button class="icon-btn share" aria-label="Bagikan" onclick={share}><Icon name="chat" /></button>{/if}
    {/if}
  </div>
  <button class="btn ghost" onclick={onclose}>{celebrate ? 'Lanjut' : 'Tutup'}</button>
</div>

<style>
  .back {
    z-index: 70;
    background: rgba(22, 40, 90, 0.4);
  }
  .sheet {
    z-index: 71;
    background: var(--arcade-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: calc(28px + var(--safe-top)) 22px calc(22px + var(--safe-bottom));
    overflow: hidden;
  }
  .sheet > :not(.preview) {
    flex-shrink: 0;
  }
  h2 {
    font-size: clamp(34px, 10vw, 44px);
    line-height: 1;
    color: var(--pink-dark);
    text-align: center;
  }
  .sub {
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
  }
  /* Kotak preview mengambil SISA tinggi layar (flex-basis 0 + min-height 0), lalu gambar
     dibatasi 100% dari kotak itu. Dulu tinggi gambar dipatok 60vh, sehingga di HP pendek
     kotaknya menyusut tapi gambarnya tidak → menimpa teks & tombol. */
  .preview {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px 14px 6px; /* ruang untuk bayangan & kemiringan gambar */
  }
  .preview img {
    display: block;
    max-height: 100%;
    max-width: 100%;
    width: auto;
    height: auto;
    border: 2.5px solid var(--ink);
    box-shadow: 6px 6px 0 var(--ink);
    rotate: -1.5deg;
    background: #fff;
  }
  .wait {
    font-size: 26px;
    color: var(--muted-2);
    text-align: center;
  }
  .actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .grow {
    flex: 1;
  }
  .share {
    width: 54px;
    height: 54px;
  }
  .sheet > .btn.ghost {
    width: 100%;
  }
</style>
