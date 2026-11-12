<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { game } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import { Runner, type Cause } from '../lib/runner'
  import { SKOR_DOA_GAME } from '../doa'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Icon from '../components/Icon.svelte'

  const PESAN: Record<Cause, string[]> = {
    brokoli: ['Kalah sama brokoli? Seriously?', 'Brokolinya menang lagi.', 'Sayur memang musuh bersama.'],
    jam: ['Dikejar deadline, kayak biasa.', 'Alarmnya bunyi pas lagi enak-enaknya.'],
    buku: ['Ketimpa tumpukan tugas. Relate.', 'Tugasnya kebanyakan, cupcake-nya nyerah.'],
    pesawat: ['Ditabrak pesawat kertas. Langka banget.', 'Lompatnya pas banget pesawat lewat.'],
  }
  const KOIN_PER_LILIN = 5
  const KOIN_MAKS = 3

  let screen: HTMLDivElement
  let canvas: HTMLCanvasElement
  let runner: Runner | null = null

  let phase = $state<'ready' | 'run' | 'dead' | 'paused'>('ready')
  let score = $state(0)
  let candles = $state(0)
  let result = $state<{ score: number; candles: number; msg: string; record: boolean; coins: number; prevBest: number } | null>(null)
  let doaJustUnlocked = $state(false)

  function tier(s: number) {
    if (s >= 1500) return 'Cupcake legendaris. Aku nggak nyangka.'
    if (s >= 1000) return 'Pro player detected.'
    if (s >= 500) return 'Lumayan banget!'
    if (s >= 200) return 'Mulai jago nih.'
    return 'Pemanasan dulu ya.'
  }

  function onDie(cause: Cause, s: number, c: number) {
    phase = 'dead'
    sfx.hit()
    vibrate(120)
    const prevBest = game.best
    const record = s > prevBest && s > 0
    const coins = Math.min(KOIN_MAKS, Math.floor(c / KOIN_PER_LILIN))
    if (record) game.best = s
    game.coins += coins
    game.save()
    const list = PESAN[cause]
    setTimeout(() => {
      result = { score: s, candles: c, msg: list[(Math.random() * list.length) | 0], record, coins, prevBest }
      if (record) {
        sfx.tada()
        const r = screen.getBoundingClientRect()
        burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.4) / innerHeight })
      }
    }, 650)
  }

  function onScore(s: number, c: number) {
    score = s
    candles = c
    if (s >= SKOR_DOA_GAME && !game.doaGame) {
      game.doaGame = true
      game.save()
      doaJustUnlocked = true
      sfx.tada()
      game.say(`Skor ${SKOR_DOA_GAME}! Kartu doa rahasia terbuka, cek di album.`, 3800)
    }
  }

  function press(e?: Event) {
    if (!runner || phase === 'dead' || phase === 'paused') return
    if (e && 'pointerId' in e) screen.setPointerCapture?.((e as PointerEvent).pointerId)
    if (phase === 'ready') {
      phase = 'run'
      doaJustUnlocked = false
    }
    runner.press()
  }
  function release() {
    runner?.release()
  }

  function again() {
    result = null
    runner?.reset()
    phase = 'ready'
    score = 0
    candles = 0
  }

  function key(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      if (e.repeat) return
      if (phase === 'dead' && result) again()
      else press()
    } else if (e.key === 'Enter' && phase === 'dead' && result) {
      again()
    }
  }
  function keyUp(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') release()
  }

  function resume() {
    runner?.resume()
    phase = 'run'
  }

  function onVisibility() {
    if (document.hidden && phase === 'run') {
      runner?.pause()
      phase = 'paused'
    }
  }

  onMount(() => {
    runner = new Runner(canvas, {
      onScore,
      onDie,
      onJump: () => sfx.jump(),
      onCandle: () => sfx.candle(),
    })
    const ro = new ResizeObserver(() => runner?.resize(screen.clientWidth, screen.clientHeight))
    ro.observe(screen)
    runner.resize(screen.clientWidth, screen.clientHeight)
    document.addEventListener('visibilitychange', onVisibility)
    // Uji otomatis: akses engine dari konsol hanya saat `npm run dev`
    if (import.meta.env.DEV) (window as unknown as { __runner: Runner }).__runner = runner
    return () => {
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })
  onDestroy(() => runner?.destroy())
</script>

<svelte:window onkeydown={key} onkeyup={keyUp} />

<section class="scene arcade">
  <ArcadeHeader title="Lari Cupcake" coins />

  <div class="hud" aria-live="off">
    <div class="score"><span>skor</span><b>{score.toLocaleString('id-ID')}</b></div>
    <div class="pill"><Icon name="star" size={14} stroke={1.6} /> rekor {game.best.toLocaleString('id-ID')}</div>
    <div class="pill candle-pill">
      <svg aria-hidden="true" width="12" height="18" viewBox="0 0 12 26" fill="#FBD3DE" stroke="#23408E" stroke-width="2"><rect x="2" y="8" width="8" height="17" /><path d="M6 1 C10 6 9 8 6 8 C3 8 2 6 6 1Z" fill="#F6D58E" /></svg>
      {candles}
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="screen"
    bind:this={screen}
    onpointerdown={press}
    onpointerup={release}
    onpointercancel={release}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <canvas bind:this={canvas} aria-label="Game Lari Cupcake. Ketuk atau tekan spasi untuk melompat." role="img"></canvas>

    {#if phase === 'ready'}
      <div class="card start" transition:fade={{ duration: 150 }}>
        <p class="hand big">Ketuk untuk mulai</p>
        <p class="small">Ketuk = lompat · <b>tahan</b> = lompat lebih tinggi</p>
        {#if game.best > 0}<p class="small">Rekor kamu: <b>{game.best.toLocaleString('id-ID')}</b></p>{/if}
      </div>
    {:else if phase === 'paused'}
      <div class="card" transition:fade={{ duration: 150 }}>
        <p class="hand big">Jeda dulu</p>
        <button class="btn" onclick={resume}>Lanjut lari</button>
      </div>
    {:else if phase === 'dead' && result}
      <div class="card over" role="dialog" aria-labelledby="over-t" transition:scale={{ start: 0.85, duration: 250 }}>
        {#if result.record}<span class="badge">REKOR BARU!</span>{/if}
        <p id="over-t" class="hand msg">{result.msg}</p>
        <p class="final">{result.score.toLocaleString('id-ID')}</p>
        <p class="small">{tier(result.score)}</p>
        <div class="stats">
          <span>lilin <b>{result.candles}</b></span>
          {#if result.coins > 0}<span class="coin">+{result.coins} koin</span>{/if}
          {#if !result.record && result.prevBest > 0}<span>rekor <b>{result.prevBest.toLocaleString('id-ID')}</b></span>{/if}
        </div>
        {#if doaJustUnlocked}<p class="unlock">Kartu doa rahasia terbuka! Cek di album.</p>{/if}
        <div class="row">
          <button class="btn ghost" onclick={() => game.go('arcade')}>Lobi</button>
          <button class="btn grow" onclick={again}>Main lagi</button>
        </div>
      </div>
    {/if}
  </div>

  <p class="foot">
    {#if game.doaGame}
      Kartu doa rahasia sudah terbuka. Sekarang tinggal kejar rekor!
    {:else}
      Tembus skor <b>{SKOR_DOA_GAME}</b> untuk buka kartu doa rahasia · tiap {KOIN_PER_LILIN} lilin = 1 koin
    {/if}
  </p>
</section>

<style>
  .scene.arcade {
    padding-left: 16px;
    padding-right: 16px;
  }
  .hud {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .score {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-right: auto;
  }
  .score span {
    font-size: 13px;
    font-weight: 800;
    color: var(--muted);
  }
  .score b {
    font-size: 30px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .candle-pill {
    background: #ffe3ea;
  }
  /* Persegi (bukan memanjang ke bawah): lebar dunia game ≈ 400 unit, jadi rintangan
     terlihat ±1 detik sebelum sampai. Layar tinggi-sempit = waktu reaksi terlalu pendek. */
  .screen {
    position: relative;
    flex: none;
    width: min(100%, 60vh);
    aspect-ratio: 1 / 1;
    align-self: center;
    border: 2.5px solid var(--ink);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 4px 4px 0 var(--ink);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: pointer;
    background: #fbf8f1;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .card {
    position: absolute;
    left: 50%;
    top: 34%;
    translate: -50% -50%;
    width: min(300px, calc(100% - 32px));
    padding: 16px 18px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    box-shadow: 4px 4px 0 var(--pink);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: default;
  }
  .card.start {
    pointer-events: none;
    background: rgba(255, 255, 255, 0.92);
  }
  .card.over {
    top: 50%;
  }
  .big {
    font-size: 34px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .small {
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }
  .msg {
    font-size: 25px;
    line-height: 1.15;
    color: var(--ink);
  }
  .final {
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .badge {
    padding: 4px 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--butter);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1px;
    rotate: -3deg;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .coin {
    color: #8a6414;
    font-weight: 900;
  }
  .unlock {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .row {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }
  .row .btn {
    flex: 1;
    min-height: 48px;
    padding: 0 10px;
    font-size: 16px;
  }
  .row .grow {
    flex: 1.5;
  }
  .foot {
    margin-top: 14px;
    text-align: center;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }
</style>
