<script lang="ts">
  import { onDestroy } from 'svelte'
  import { config } from '../config'
  import { sfx } from '../lib/audio'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Icon from '../components/Icon.svelte'

  // Semua diproses di perangkat (canvas). Tidak ada foto yang diunggah ke mana pun.
  const W = 300
  const H = 400
  const open = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  const sparkles = `<path d="M252 54 C254 40 256 38 270 36 C256 34 254 32 252 18 C250 32 248 34 234 36 C248 38 250 40 252 54 Z" fill="#F6D58E" stroke="#fff" stroke-width="2.5"/><path d="M44 94 C45 86 46 85 54 84 C46 83 45 82 44 74 C43 82 42 83 34 84 C42 85 43 86 44 94 Z" fill="#9CCBF0" stroke="#fff" stroke-width="2.5"/>`
  const DOODLES = {
    topi: {
      label: 'Topi pesta',
      svg: open(`<path d="M112 128 L152 20 L192 126 Z" fill="#FFC9D9" stroke="#fff" stroke-width="4"/><path d="M122 100 C140 92 166 94 184 102 M134 70 C146 64 162 66 172 70 M144 44 C150 40 156 41 162 44" stroke="#C93D66" stroke-width="3.5"/><circle cx="152" cy="16" r="12" fill="#F6D58E" stroke="#fff" stroke-width="4"/><path d="M108 128 C132 138 172 138 196 126" stroke="#fff" stroke-width="4"/>${sparkles}`),
    },
    mahkota: {
      label: 'Mahkota',
      svg: open(`<path d="M94 128 L102 62 L128 96 L150 50 L172 96 L198 62 L206 128 Z" fill="#F6D58E" stroke="#fff" stroke-width="4"/><circle cx="150" cy="112" r="8" fill="#F28AA5" stroke="#fff" stroke-width="3"/><circle cx="118" cy="114" r="6" fill="#9CCBF0" stroke="#fff" stroke-width="3"/><circle cx="182" cy="114" r="6" fill="#8ED3BE" stroke="#fff" stroke-width="3"/>${sparkles}`),
    },
    kacamata: {
      label: 'Kacamata',
      svg: open(`<path d="M114 186 C96 186 88 200 92 214 C96 228 124 232 136 218 C146 204 138 186 114 186 Z M186 186 C204 186 212 200 208 214 C204 228 176 232 164 218 C154 204 162 186 186 186 Z" fill="#F28AA5" fill-opacity="0.45" stroke="#fff" stroke-width="5"/><path d="M138 198 C146 192 154 192 162 198" stroke="#fff" stroke-width="5"/><path d="M100 196 l8 -4 M172 196 l8 -4" stroke="#fff" stroke-width="3"/>${sparkles}`),
    },
    bingkai: {
      label: 'Bingkai krayon',
      svg: open(`<path d="M12 14 C100 6 200 18 288 10 M12 14 C8 140 16 260 10 388 M288 10 C294 140 284 260 292 388 M10 388 C100 394 200 382 292 390" stroke="#F28AA5" stroke-width="7"/><path d="M22 24 C100 18 200 28 278 20 M20 24 C18 150 24 260 20 378 M278 20 C282 150 274 260 280 378 M20 378 C100 384 200 372 280 380" stroke="#9CCBF0" stroke-width="3" stroke-dasharray="2 10"/>${sparkles}`),
    },
  } as const
  type DKey = keyof typeof DOODLES
  const KEYS = Object.keys(DOODLES) as DKey[]

  let doodle = $state<DKey>('topi')
  let status = $state<'idle' | 'starting' | 'live' | 'error' | 'shot'>('idle')
  let facing = $state<'user' | 'environment'>('user')
  let timer = $state(false)
  let countdown = $state(0)
  let shot = $state('')
  let video = $state<HTMLVideoElement>()
  let stream: MediaStream | null = null

  async function start() {
    status = 'starting'
    stop()
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false })
      status = 'live'
      await Promise.resolve()
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
    } catch {
      status = 'error'
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
  }

  async function flip() {
    facing = facing === 'user' ? 'environment' : 'user'
    await start()
  }

  async function capture() {
    if (!video) return
    if (timer) {
      for (countdown = 3; countdown > 0; countdown--) {
        sfx.tap()
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    sfx.shutter()
    const S = 3
    const c = document.createElement('canvas')
    c.width = W * S
    c.height = H * S
    const ctx = c.getContext('2d')!
    const vw = video.videoWidth
    const vh = video.videoHeight
    const target = W / H
    let sw = vw
    let sh = vw / target
    if (sh > vh) {
      sh = vh
      sw = vh * target
    }
    const sx = (vw - sw) / 2
    const sy = (vh - sh) / 2
    ctx.save()
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height)
    ctx.restore()
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(DOODLES[doodle].svg)
    await img.decode().catch(() => {})
    ctx.drawImage(img, 0, 0, c.width, c.height)
    // stempel
    ctx.save()
    ctx.translate(70 * S, 352 * S)
    ctx.rotate(-0.17)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#23408E'
    ctx.lineWidth = 2.5 * S
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(-46 * S, -26 * S, 92 * S, 52 * S, 10 * S)
    else ctx.rect(-46 * S, -26 * S, 92 * S, 52 * S) // iOS < 16
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#C93D66'
    ctx.font = `700 ${34 * S}px Caveat, cursive`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('21!', 0, 2 * S)
    ctx.restore()
    shot = c.toDataURL('image/png')
    status = 'shot'
  }

  async function share() {
    try {
      const blob = await (await fetch(shot)).blob()
      const file = new File([blob], `ultah-${config.nama.toLowerCase()}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
    } catch {
      /* dibatalkan */
    }
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare

  onDestroy(stop)
</script>

<section class="scene arcade">
  <ArcadeHeader title="Photobooth" />

  <div class="finder">
    {#if status === 'shot'}
      <img src={shot} alt="Hasil foto dengan doodle" />
    {:else}
      {#if status === 'live' || status === 'starting'}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={video} class:mirror={facing === 'user'} playsinline muted autoplay></video>
      {:else}
        <div class="empty">
          {#if status === 'error'}
            <p>Kamera nggak bisa dibuka. Cek izin kamera di pengaturan browser, lalu coba lagi.</p>
          {:else}
            <p>Posisikan wajahmu di tengah, doodle-nya nanti nempel otomatis.</p>
          {/if}
          <button class="btn pink" onclick={start}><Icon name="camera" /> Buka kamera</button>
        </div>
      {/if}
      {#if status === 'live'}
        <div class="overlay" aria-hidden="true">{@html DOODLES[doodle].svg}</div>
        <span class="stamp hand" aria-hidden="true">21!</span>
      {/if}
      {#if countdown > 0}<span class="count">{countdown}</span>{/if}
    {/if}
  </div>

  {#if status === 'shot'}
    <div class="row">
      <button class="btn ghost" onclick={start}>Ulangi</button>
      <a class="btn grow" href={shot} download="ultah-{config.nama.toLowerCase()}.png"><Icon name="download" /> Simpan</a>
      {#if canShare}<button class="icon-btn share" aria-label="Bagikan" onclick={share}><Icon name="chat" /></button>{/if}
    </div>
  {:else}
    <div class="chips" role="radiogroup" aria-label="Pilih doodle">
      {#each KEYS as k (k)}
        <button class="chip" class:on={doodle === k} role="radio" aria-checked={doodle === k} onclick={() => (doodle = k)}>{DOODLES[k].label}</button>
      {/each}
    </div>
    <div class="shutter-row">
      <button class="icon-btn big" aria-label="Ganti kamera" onclick={flip} disabled={status !== 'live'}><Icon name="switch" size={22} /></button>
      <button class="shutter" aria-label="Ambil foto" onclick={capture} disabled={status !== 'live' || countdown > 0}><span></span></button>
      <button class="icon-btn big timer" class:on={timer} aria-label="Timer 3 detik" aria-pressed={timer} onclick={() => (timer = !timer)}>3s</button>
    </div>
  {/if}

  <p class="privacy"><Icon name="lock" size={16} /> Fotonya cuma diproses di HP kamu, nggak dikirim ke mana-mana.</p>
</section>

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .finder {
    position: relative;
    width: min(100%, 40vh);
    align-self: center;
    aspect-ratio: 3 / 4;
    border: 2.5px solid var(--ink);
    border-radius: 22px;
    background: #2a2f45;
    overflow: hidden;
    box-shadow: 4px 4px 0 var(--ink);
    flex-shrink: 0;
  }
  video,
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .mirror {
    transform: scaleX(-1);
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .overlay :global(svg) {
    width: 100%;
    height: 100%;
  }
  .stamp {
    position: absolute;
    left: calc(70 / 300 * 100%);
    top: calc(352 / 400 * 100%);
    translate: -50% -50%;
    rotate: -10deg;
    padding: 2px 16px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 10px;
    font-size: 30px;
    color: var(--pink-dark);
    pointer-events: none;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
    color: #e8ebf5;
    font-size: 14px;
    line-height: 1.5;
    z-index: 2;
  }
  .count {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 110px;
    font-weight: 900;
    color: #fff;
    text-shadow: 4px 4px 0 var(--ink);
  }
  .chips {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .chips .chip {
    height: 40px;
    cursor: pointer;
  }
  .chips .chip.on {
    background: var(--ink);
    color: #fff;
  }
  .shutter-row {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .big {
    width: 52px;
    height: 52px;
    font-weight: 900;
    font-size: 15px;
    color: var(--ink);
  }
  .timer.on {
    background: var(--butter);
  }
  .icon-btn:disabled {
    opacity: 0.45;
  }
  .shutter {
    width: 84px;
    height: 84px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 5px 0 var(--ink);
    cursor: pointer;
  }
  .shutter span {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: var(--pink-dark);
    border: 2px solid var(--ink);
  }
  .shutter:disabled {
    opacity: 0.5;
  }
  .row {
    margin-top: 16px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .row .btn {
    flex: 1;
    padding: 0 10px;
  }
  .row .grow {
    flex: 1.4;
  }
  .share {
    width: 54px;
    height: 54px;
  }
  .privacy {
    margin-top: auto;
    padding-top: 14px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 600;
    color: var(--text);
  }
</style>
