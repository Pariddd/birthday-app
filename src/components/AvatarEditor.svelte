<script lang="ts">
  import { onDestroy } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import Icon from './Icon.svelte'

  // Atur foto profil: geser (drag), perbesar (pinch / slider / scroll), lingkaran = hasil akhir.
  let { file, onclose, onsave, onpick }: { file: File; onclose: () => void; onsave: (b: Blob) => Promise<void> | void; onpick: () => void } = $props()

  const OUT = 400 // ukuran hasil (px)
  const ZMAX = 4

  let box = $state<HTMLDivElement>()
  let V = $state(280) // sisi viewport (px CSS)
  let bmp: ImageBitmap | null = null
  let url = $state('')
  let w = $state(0)
  let h = $state(0)
  let z = $state(1) // perbesaran relatif (1 = pas menutupi lingkaran)
  let x = $state(0) // posisi kiri-atas gambar di viewport
  let y = $state(0)
  let error = $state('')
  let saving = $state(false)

  const base = $derived(w && h ? Math.max(V / w, V / h) : 1)
  const scale = $derived(base * z)

  function clamp() {
    const dw = w * scale
    const dh = h * scale
    x = Math.min(0, Math.max(V - dw, x))
    y = Math.min(0, Math.max(V - dh, y))
  }

  /** Ubah perbesaran sambil menjaga titik (px, py) di viewport tetap di tempatnya. */
  function zoomTo(nz: number, px = V / 2, py = V / 2) {
    nz = Math.min(ZMAX, Math.max(1, nz))
    const ix = (px - x) / scale
    const iy = (py - y) / scale
    z = nz
    const s = base * nz
    x = px - ix * s
    y = py - iy * s
    clamp()
  }

  $effect(() => {
    void file
    let batal = false
    ;(async () => {
      try {
        bmp?.close()
        const b = await createImageBitmap(file) // orientasi EXIF diterapkan
        if (batal) return b.close()
        bmp = b
        if (box?.clientWidth) V = box.clientWidth // ukur ukuran nyata, jangan tebakan awal
        w = b.width
        h = b.height
        if (url) URL.revokeObjectURL(url)
        url = URL.createObjectURL(file)
        z = 1
        const s = Math.max(V / w, V / h)
        x = (V - w * s) / 2
        y = (V - h * s) / 2
        error = ''
      } catch {
        error = 'File itu tidak bisa dibaca sebagai foto.'
      }
    })()
    return () => {
      batal = true
    }
  })

  // ---- geser & pinch (pointer events: jalan di HP & laptop) ----
  const pts = new Map<number, { x: number; y: number }>()
  let pinch: { d: number; z: number } | null = null

  function down(e: PointerEvent) {
    box?.setPointerCapture(e.pointerId)
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z }
    }
  }
  function move(e: PointerEvent) {
    const p = pts.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]
      const r = box!.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - r.left
      const my = (a.y + b.y) / 2 - r.top
      zoomTo((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d, mx, my)
    } else if (pts.size === 1) {
      x += dx
      y += dy
      clamp()
    }
  }
  function up(e: PointerEvent) {
    pts.delete(e.pointerId)
    if (pts.size < 2) pinch = null
  }
  function wheel(e: WheelEvent) {
    e.preventDefault()
    const r = box!.getBoundingClientRect()
    zoomTo(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top)
  }
  function key(e: KeyboardEvent) {
    const step = 10
    if (e.key === 'ArrowLeft') x += step
    else if (e.key === 'ArrowRight') x -= step
    else if (e.key === 'ArrowUp') y += step
    else if (e.key === 'ArrowDown') y -= step
    else if (e.key === '+' || e.key === '=') return zoomTo(z * 1.1)
    else if (e.key === '-') return zoomTo(z / 1.1)
    else if (e.key === 'Escape') return onclose()
    else return
    e.preventDefault()
    clamp()
  }

  async function simpan() {
    if (!bmp || saving) return
    saving = true
    try {
      const c = document.createElement('canvas')
      c.width = c.height = OUT
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, OUT, OUT)
      ctx.imageSmoothingQuality = 'high'
      // Area yang terlihat di lingkaran → koordinat gambar asli.
      ctx.drawImage(bmp, -x / scale, -y / scale, V / scale, V / scale, 0, 0, OUT, OUT)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86))
      if (!blob) throw new Error()
      await onsave(blob)
    } catch {
      error = 'Gagal menyimpan foto.'
    } finally {
      saving = false
    }
  }

  $effect(() => {
    const el = box
    if (!el) return
    const ro = new ResizeObserver(() => {
      const nv = el.clientWidth
      if (!nv || nv === V) return
      // Pertahankan komposisi saat ukuran layar berubah.
      const k = nv / V
      V = nv
      x *= k
      y *= k
      clamp()
    })
    ro.observe(el)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel)
    }
  })
  onDestroy(() => {
    bmp?.close()
    if (url) URL.revokeObjectURL(url)
  })
</script>

<div class="back overlay-fixed" transition:fade={{ duration: 150 }}></div>
<div class="ed overlay-fixed" role="dialog" aria-modal="true" aria-labelledby="ed-t" transition:fly={{ y: 40, duration: 250 }}>
  <div class="head">
    <h3 id="ed-t" class="hand">Atur foto profil</h3>
    <button class="icon-btn" aria-label="Tutup" onclick={onclose}><Icon name="close" /></button>
  </div>
  <p class="tip">Geser untuk mengatur posisi · cubit atau pakai slider untuk perbesar</p>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="vp"
    bind:this={box}
    role="application"
    aria-label="Area foto. Seret untuk menggeser, panah untuk menggeser, plus/minus untuk perbesar."
    tabindex="0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onlostpointercapture={up}
    ondragstart={(e) => e.preventDefault()}
    onkeydown={key}
  >
    {#if url && w}
      <img src={url} alt="" draggable="false" style="width:{w * scale}px;height:{h * scale}px;transform:translate({x}px,{y}px)" />
    {/if}
    <div class="mask" aria-hidden="true"></div>
  </div>

  <label class="zoom">
    <Icon name="image" size={16} />
    <input type="range" min="1" max={ZMAX} step="0.01" value={z} oninput={(e) => zoomTo(Number(e.currentTarget.value))} aria-label="Perbesar" />
    <Icon name="image" size={24} />
  </label>

  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <div class="acts">
    <button class="btn ghost" onclick={onpick} disabled={saving}>Ganti gambar</button>
    <button class="btn pink grow" onclick={simpan} disabled={saving || !w}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
  </div>
</div>

<style>
  .back {
    z-index: 90;
    background: rgba(22, 30, 60, 0.6);
  }
  .ed {
    z-index: 91;
    top: auto;
    background: var(--paper);
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    max-height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 20px calc(18px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .head {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    font-size: 32px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .tip {
    width: 100%;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--muted-2);
  }
  .vp {
    position: relative;
    flex-shrink: 0; /* jangan sampai tergencet jadi 0 px di layar pendek */
    width: min(76vw, 300px, 52vh);
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 18px;
    background: #1d2340;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
  }
  .vp:active {
    cursor: grabbing;
  }
  .vp:focus-visible {
    outline: 3px solid var(--pink);
    outline-offset: 3px;
  }
  img {
    position: absolute;
    left: 0;
    top: 0;
    max-width: none;
    transform-origin: 0 0;
    pointer-events: none;
    -webkit-user-drag: none;
  }
  /* Lingkaran = bagian yang tersimpan; luar lingkaran digelapkan. */
  .mask {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 50%;
    box-shadow:
      0 0 0 3px #fff,
      0 0 0 999px rgba(22, 30, 60, 0.55);
  }
  .zoom {
    width: min(76vw, 300px, 52vh);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
  }
  .zoom input {
    flex: 1;
    accent-color: var(--pink-dark);
    height: 28px;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .acts {
    width: 100%;
    display: flex;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }
</style>
