<script lang="ts">
  import { onDestroy } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import gsap from 'gsap'
  import { game } from '../lib/state.svelte'
  import { sfx, duckMusic } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import { listenForBlow, type BlowListener } from '../lib/mic'
  import Cake from '../components/Cake.svelte'
  import Icon from '../components/Icon.svelte'

  const WICKS: [number, number][] = [
    [130, 40],
    [182, 40],
  ]

  let lit = $state([false, false])
  let sulked = false
  let phase = $state<'light' | 'ready' | 'listening' | 'blown' | 'wish'>('light')
  let micFailed = $state(false)
  let level = $state(0)
  let dragging = $state(false)
  let matchPos = $state<{ x: number; y: number } | null>(null)
  let cakeTaps = 0

  let section: HTMLElement
  let cakeBox: HTMLDivElement
  let boxEl = $state<HTMLButtonElement>()
  let listener: BlowListener | null = null

  const allLit = $derived(lit[0] && lit[1])
  const litCount = $derived(lit.filter(Boolean).length)

  function wickScreen(i: number) {
    const svg = cakeBox.querySelector('svg') as SVGSVGElement
    const m = svg.getScreenCTM()!
    const pt = svg.createSVGPoint()
    pt.x = WICKS[i][0]
    pt.y = WICKS[i][1]
    return pt.matrixTransform(m)
  }

  function local(e: PointerEvent) {
    const r = section.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top - (e.pointerType === 'touch' ? 34 : 0) }
  }

  function grab(e: PointerEvent) {
    if (phase !== 'light') return
    e.preventDefault()
    dragging = true
    matchPos = local(e)
    sfx.fwoosh()
    section.setPointerCapture?.(e.pointerId)
  }

  function drag(e: PointerEvent) {
    if (!dragging) return
    matchPos = local(e)
    const r = section.getBoundingClientRect()
    for (let i = 0; i < 2; i++) {
      if (lit[i]) continue
      const w = wickScreen(i)
      if (Math.hypot(w.x - r.left - matchPos.x, w.y - r.top - matchPos.y) < 34) light(i)
    }
  }

  function drop() {
    if (!dragging) return
    dragging = false
    const r = section.getBoundingClientRect()
    if (!boxEl) {
      matchPos = null
      return
    }
    const b = boxEl.getBoundingClientRect()
    const target = { x: b.left - r.left + b.width / 2, y: b.top - r.top + 6 }
    gsap.to(matchPos!, { ...target, duration: 0.35, ease: 'power2.out', onUpdate: () => (matchPos = { ...matchPos! }), onComplete: () => (matchPos = null) })
  }

  function light(i: number) {
    lit[i] = true
    sfx.fwoosh()
    vibrate(15)
    if (i === 1 && !sulked) {
      sulked = true
      setTimeout(() => {
        lit[1] = false
        game.say('Lilin "1"-nya ngambek. Nyalain lagi dong.')
      }, 1300)
    }
    if (lit[0] && lit[1]) {
      setTimeout(() => {
        if (lit[0] && lit[1]) phase = 'ready'
      }, 1500)
    }
  }

  async function startBlow() {
    phase = 'listening'
    duckMusic(true)
    try {
      listener = await listenForBlow((l) => (level = l), blowOut)
    } catch {
      micFailed = true
    }
  }

  function blowOut() {
    if (phase === 'blown' || phase === 'wish') return
    listener?.stop()
    listener = null
    phase = 'blown'
    sfx.blow()
    vibrate(60)
    lit = [false, false]
    gsap.fromTo('.smoke', { y: 0, opacity: 0.8, scale: 0.6 }, { y: -50, opacity: 0, scale: 1.6, duration: 1.6, ease: 'power1.out', stagger: 0.12, transformOrigin: '50% 100%' })
    setTimeout(() => {
      duckMusic(false)
      sfx.tada()
      burst({ big: true, y: 0.5 })
      phase = 'wish'
    }, 1300)
  }

  function tapCake() {
    cakeTaps++
    if (cakeTaps === 5) game.findSecret(0)
  }

  onDestroy(() => {
    listener?.stop()
    duckMusic(false)
  })
</script>

<section class="scene" bind:this={section} onpointermove={drag} onpointerup={drop} onpointercancel={drop}>
  <div class="dim" class:on={phase === 'listening' || phase === 'blown'} aria-hidden="true"></div>

  <div class="head">
    {#if phase === 'light'}
      <h1 class="hand">Nyalain lilinnya</h1>
      <p>Tarik korek dari kotaknya ke sumbu.</p>
      <span class="chip lit-chip">{litCount}/2 menyala</span>
    {:else if phase === 'ready'}
      <h1 class="hand">Siap ditiup!</h1>
      <p>Matiin lampunya dulu ya…</p>
    {:else if phase === 'listening'}
      <h1 class="hand light">Tiup ke mic HP-mu</h1>
      <p class="light">Yang kenceng, kayak niup lilin beneran.</p>
    {/if}
  </div>

  <div class="cake-area">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="cake" bind:this={cakeBox} onclick={tapCake}>
      <Cake colors={game.cake} viewBox="0 -70 300 330" label="Kue dengan lilin angka 2 dan 1, {litCount} menyala">
        <svg overflow="visible">
          <text x="130" y="110" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="78" fill="#FBD3DE" stroke="#23408E" stroke-width="2.6" paint-order="stroke">2</text>
          <text x="180" y="110" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="78" fill="#CFE6F7" stroke="#23408E" stroke-width="2.6" paint-order="stroke">1</text>
          {#each WICKS as w, i (i)}
            <path d="M{w[0]} 54 L{w[0]} 40" stroke="#23408E" stroke-width="2.2" />
            {#if lit[i]}
              <g transform="translate({w[0]} 0)">
                <circle cx="0" cy="18" r="32" fill="#FFF0B3" fill-opacity="0.75" stroke="none" />
                <g class="flame">
                  <path d="M0 -6 C12 10 14 22 8 32 C4 38 -4 38 -8 32 C-14 22 -12 10 0 -6 Z" fill="#F6D58E" stroke="#23408E" stroke-width="2.4" />
                  <path d="M0 12 C6 20 6 28 3 32 C1 35 -1 35 -3 32 C-6 28 -6 20 0 12 Z" fill="#F28AA5" stroke="none" />
                </g>
              </g>
            {/if}
            <path class="smoke" d="M{w[0]} 36 C{w[0] - 8} 26 {w[0] + 8} 16 {w[0]} 4 C{w[0] - 8} -8 {w[0] + 6} -16 {w[0]} -26" stroke="#9AA6C8" stroke-width="3" opacity="0" />
          {/each}
        </svg>
      </Cake>
    </div>
  </div>

  <div class="foot" class:with-box={phase === 'light'}>
    {#if phase === 'light' || phase === 'ready'}
      <button class="btn pink wide" disabled={!allLit || phase !== 'ready'} onclick={startBlow}><Icon name="mic" /> Tiup lilin</button>
      <p class="note hand">{phase === 'ready' ? 'nanti HP-mu minta izin mikrofon, izinin ya' : 'nyalain semua dulu, baru boleh ditiup'}</p>
    {:else if phase === 'listening'}
      <div class="meter" aria-hidden="true"><div style="width:{Math.min(100, level * 160)}%"></div></div>
      <button class="btn ghost wide" onclick={blowOut}>{micFailed ? 'Mic-nya nggak bisa. Tiup manual' : 'Tiup manual (tanpa mic)'}</button>
    {/if}
  </div>

  {#if phase === 'light'}
    <button class="matchbox" bind:this={boxEl} aria-label="Kotak korek. Tarik korek ke sumbu lilin." onpointerdown={grab}>
      <svg viewBox="0 0 90 70" fill="none" stroke="#23408E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if !dragging}<path d="M58 14 L74 -14" stroke-width="5" /><path d="M58 14 L74 -14" stroke="#FFF7DC" stroke-width="2" /><circle cx="75" cy="-15" r="6" fill="#C93D66" />{/if}
        <rect x="6" y="14" width="78" height="48" rx="5" fill="#F28AA5" />
        <rect x="12" y="26" width="66" height="22" rx="3" fill="#FBF8F1" stroke-width="1.6" />
        <path d="M22 37 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5" stroke="#C93D66" stroke-width="1.6" />
      </svg>
    </button>
  {/if}

  {#if matchPos}
    <svg class="match" style="left:{matchPos.x}px;top:{matchPos.y}px" viewBox="-14 -26 80 100" fill="none" stroke="#23408E" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 4 L56 66" stroke-width="7" />
      <path d="M2 4 L56 66" stroke="#FFF7DC" stroke-width="3" />
      <circle cx="0" cy="0" r="7" fill="#C93D66" stroke-width="1.8" />
      {#if dragging}<path class="flame" d="M-2 -22 C6 -12 8 -6 4 0 C0 3 -4 2 -6 -2 C-9 -8 -8 -14 -2 -22 Z" fill="#F6D58E" stroke-width="1.8" />{/if}
    </svg>
  {/if}

  {#if phase === 'wish'}
    <div class="wish-back" transition:fade={{ duration: 200 }}></div>
    <div class="wish" role="dialog" aria-modal="true" aria-labelledby="wish-t" transition:scale={{ start: 0.85, duration: 300 }}>
      <h2 id="wish-t" class="hand">Make a wish</h2>
      <p>Tutup mata sebentar, bikin permohonan… aku nggak ngintip kok.</p>
      <button class="btn" onclick={() => game.next()}>Sudah! <Icon name="next" /></button>
    </div>
  {/if}
</section>

<style>
  .scene {
    touch-action: none;
    overflow: hidden;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: #17142a;
    opacity: 0;
    transition: opacity 0.8s;
    pointer-events: none;
    z-index: 1;
  }
  .dim.on {
    opacity: 0.82;
  }
  .head,
  .foot {
    position: relative;
    z-index: 3;
  }
  .head {
    min-height: 110px;
  }
  h1 {
    font-size: clamp(38px, 11vw, 44px);
    line-height: 1;
  }
  .head p {
    margin-top: 6px;
    font-size: 15px;
    color: var(--muted);
  }
  .light {
    color: #f5eedc !important;
  }
  .lit-chip {
    margin-top: 10px;
    background: var(--butter-soft);
  }
  .cake-area {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
  }
  .cake {
    width: min(100%, 300px, 40vh);
    margin-left: -16px;
  }
  .flame {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: flicker 0.5s ease-in-out infinite;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .foot.with-box {
    padding-right: 96px;
  }
  .wide {
    width: 100%;
  }
  .note {
    font-size: 20px;
    font-weight: 500;
    color: var(--muted-2);
    text-align: center;
  }
  .meter {
    width: 100%;
    height: 14px;
    border: 2px solid #f5eedc;
    border-radius: 999px;
    overflow: hidden;
  }
  .meter div {
    height: 100%;
    background: var(--butter);
    transition: width 0.08s;
  }
  .matchbox {
    position: absolute;
    right: 16px;
    bottom: calc(30px + var(--safe-bottom));
    width: 90px;
    height: 100px;
    padding: 30px 0 0;
    border: none;
    background: none;
    cursor: grab;
    touch-action: none;
    z-index: 3;
    transform: rotate(-8deg);
  }
  .matchbox svg {
    width: 90px;
    height: 70px;
    overflow: visible;
  }
  .match {
    position: absolute;
    width: 80px;
    height: 100px;
    margin-left: -14px;
    margin-top: -26px;
    pointer-events: none;
    z-index: 10;
    overflow: visible;
    transform-origin: 14px 26px;
    transform: rotate(-12deg);
  }
  .wish-back {
    position: absolute;
    inset: 0;
    background: rgba(22, 40, 90, 0.25);
    z-index: 30;
  }
  .wish {
    position: absolute;
    left: 28px;
    right: 28px;
    top: 50%;
    translate: 0 -50%;
    z-index: 31;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 22px 16px 24px 18px;
    box-shadow: 6px 6px 0 var(--pink);
    padding: 26px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .wish h2 {
    font-size: 52px;
    color: var(--pink-dark);
    line-height: 1;
  }
  .wish p {
    font-size: 16px;
    line-height: 1.5;
    color: var(--muted);
  }
</style>
