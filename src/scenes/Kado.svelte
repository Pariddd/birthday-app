<script lang="ts">
  import gsap from 'gsap'
  import { fly, fade } from 'svelte/transition'
  import { config } from '../config'
  import { game, reducedMotion } from '../lib/state.svelte'
  import { sfx, startMusic, unlockAudio } from '../lib/audio'
  import { burst, draw, vibrate } from '../lib/fx'
  import Icon from '../components/Icon.svelte'

  // Jumlah ketukan sampai kado meledak
  const TAPS = 5
  const HINTS = ['ketuk aku!', 'lagi!', 'eh, kok gerak…', 'dikit lagi…', 'AWAS MAU MELEDAK!']
  const BOX = ['#FBD3DE', '#F9C3D2', '#F7B0C3', '#F49CB3', '#F087A3']

  let taps = $state(0)
  let opened = $state(false)
  let flash = $state(false)
  let lid: SVGGElement
  let body: SVGSVGElement
  let box: HTMLButtonElement

  const level = $derived(Math.min(taps, TAPS - 1))
  // getaran makin kencang & cepat tiap level
  const amp = $derived([0, 1.5, 3, 5, 7.5][level])
  const speed = $derived([0, 0.5, 0.32, 0.2, 0.12][level])

  function tap() {
    if (opened) return
    unlockAudio()
    taps++
    if (taps >= TAPS) return explode()

    sfx.charge(taps)
    vibrate(10 + taps * 12)
    if (reducedMotion) return
    // efek "squash" tiap ketukan + tutup kado makin terangkat
    gsap.fromTo(body, { scaleX: 1.1 + taps * 0.02, scaleY: 0.88 - taps * 0.02 }, { scaleX: 1, scaleY: 1, duration: 0.55, ease: 'elastic.out(1, 0.35)', transformOrigin: '50% 95%' })
    gsap.to(lid, { y: -taps * 5, rotate: (taps % 2 ? -1 : 1) * taps * 1.6, transformOrigin: '50% 100%', duration: 0.25, ease: 'back.out(3)' })
    const r = box.getBoundingClientRect()
    if (taps >= 2) burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.4) / innerHeight, small: true })
  }

  function explode() {
    opened = true
    vibrate(80)
    const r = box.getBoundingClientRect()
    const tl = gsap.timeline()
    if (!reducedMotion) {
      // tahan napas sebentar… lalu DOR
      tl.to(body, { scaleX: 0.86, scaleY: 1.14, duration: 0.18, ease: 'power2.in', transformOrigin: '50% 95%' })
    }
    tl.add(() => {
      sfx.boom()
      startMusic()
      flash = true
      setTimeout(() => (flash = false), 140)
      burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.45) / innerHeight, big: true })
      setTimeout(() => sfx.tada(), 250)
    })
      .to(body, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' })
      .to(lid, { y: -300, x: 90, rotate: 40, opacity: 0, duration: 0.8, ease: 'power2.out' }, '<')
  }
</script>

<section class="scene">
  <div class="head">
    {#if !opened}
      <h1 class="hand">Hai, {config.nama}!</h1>
      <p>Ada yang nungguin kamu dari tadi…</p>
    {:else}
      <h1 class="hand big" in:fly={{ y: 20, duration: 500, delay: 500 }}>Selamat ulang tahun, {config.nama}!</h1>
    {/if}
  </div>

  <div class="gift-area">
    <button
      class="gift"
      class:idle={taps === 0 && !opened}
      class:rattle={taps > 0 && !opened}
      style="--a:{amp}px; --r:{amp * 0.6}deg; --s:{speed}s; scale:{opened ? 1 : 1 + level * 0.05}"
      bind:this={box}
      onclick={tap}
      aria-label={opened ? 'Kado sudah terbuka' : `Ketuk kado untuk membuka, ${TAPS - taps} ketukan lagi`}
      disabled={opened}
    >
      <svg bind:this={body} viewBox="0 0 220 220" fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" use:draw>
        <!-- garis gerak: makin banyak seiring level -->
        {#if !opened}
          <g class="lines" data-nodraw>
            <path d="M14 120 C8 112 8 100 14 92 M206 118 C212 110 212 98 206 90" stroke-width="2.2" />
            {#if level >= 2}<path d="M4 132 C-2 116 -2 96 4 80 M216 130 C222 114 222 94 216 78" stroke-width="2" stroke-opacity="0.6" />{/if}
            {#if level >= 3}<path d="M60 30 l-8 -14 M110 22 l0 -16 M160 30 l8 -14" stroke="#E0557A" stroke-width="2.6" />{/if}
            {#if level >= 4}<path d="M30 60 l-14 -8 M190 60 l14 -8 M20 180 l-14 4 M200 180 l14 4" stroke="#E0557A" stroke-width="2.6" />{/if}
          </g>
        {/if}
        <path d="M40 102 L180 99 L178 198 L42 200 Z" fill={BOX[level]} style="transition: fill .3s" />
        <path d="M50 120 L64 108 M50 140 L84 110 M52 162 L98 118 M56 182 L100 142 M70 194 L100 168" stroke="#E0557A" stroke-width="1.4" stroke-opacity="0.6" />
        <path d="M100 100 L121 99 L120 199 L101 200 Z" fill="#F6D58E" />
        {#if level >= 3 && !opened}
          <!-- retakan kecil: kado "kepenuhan" -->
          <path d="M150 118 l8 10 -6 6 10 12 M66 150 l-8 8 6 6 -8 10" stroke="#23408E" stroke-width="2" data-nodraw />
        {/if}
        {#if opened}
          <path d="M44 104 C60 92 160 92 176 102" stroke-width="2" stroke-opacity="0.5" />
          <!-- bintang & hati yang "keluar" dari dalam kado -->
          <g class="pop-out" data-nodraw stroke-width="2.2">
            <path d="M110 30 C111 46 114 50 128 52 C114 54 111 58 110 74 C109 58 106 54 92 52 C106 50 109 46 110 30 Z" fill="#F6D58E" />
            <path d="M58 58 C58 50 66 47 70 53 C74 47 82 50 82 58 C82 68 70 74 70 74 C70 74 58 68 58 58 Z" fill="#F28AA5" />
            <path d="M156 46 l5 10 11 1 -8 7 2 11 -10 -6 -10 6 2 -11 -8 -7 11 -1 z" fill="#9CCBF0" />
            <path d="M84 92 l-6 -14 M136 92 l6 -14 M110 90 l0 -10" stroke="#E0557A" />
          </g>
        {/if}
        <g bind:this={lid}>
          <path d="M30 79 L190 76 L192 104 L28 106 Z" fill="#FFE3EA" />
          <path d="M33 82 L187 79 L189 101 L31 103 Z" stroke-opacity="0.3" stroke-width="1.3" />
          <path d="M100 78 L121 77 L121 104 L100 105 Z" fill="#F6D58E" />
          <path d="M110 76 C92 38 58 46 70 68 C78 80 98 78 110 76 Z" fill="#F6D58E" />
          <path d="M110 76 C128 38 162 46 150 68 C142 80 122 78 110 76 Z" fill="#F6D58E" />
          <path d="M84 62 C90 64 98 70 104 74 M136 62 C130 64 122 70 116 74" stroke-width="1.6" />
        </g>
        <ellipse cx="110" cy="210" rx="78" ry="6" fill="#23408E" fill-opacity="0.12" stroke="none" />
      </svg>
    </button>

    {#if !opened}
      <div class="tap-hint" aria-hidden="true">
        {#if taps === 0}
          <svg viewBox="0 0 64 56" fill="none" stroke="#C93D66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M58 50 C40 50 18 40 10 12" /><path d="M4 20 L10 10 L18 18" /></svg>
        {/if}
        {#key taps}
          <span class="hand" class:loud={level >= 4} in:fly={{ y: 8, duration: 200 }}>{HINTS[level]}</span>
        {/key}
      </div>
      <div class="meter" aria-hidden="true">
        {#each Array(TAPS) as _, i (i)}<span class:on={i < taps}></span>{/each}
      </div>
    {/if}
  </div>

  {#if flash}<div class="flash" out:fade={{ duration: 260 }}></div>{/if}

  <div class="foot">
    {#if opened}
      <div in:fly={{ y: 20, duration: 400, delay: 1400 }}>
        <button class="btn" onclick={() => game.next()}>Lanjut <Icon name="next" /></button>
      </div>
    {:else}
      <p class="muted">Nyalain suara HP-mu dulu ya</p>
    {/if}
  </div>
</section>

<style>
  .head {
    min-height: 110px;
  }
  h1 {
    font-size: clamp(48px, 15vw, 60px);
    line-height: 0.95;
  }
  h1.big {
    font-size: clamp(42px, 12vw, 54px);
    color: var(--pink-dark);
  }
  .head p {
    margin-top: 8px;
    font-size: 17px;
    color: var(--muted);
  }
  .gift-area {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
  }
  .gift {
    width: min(250px, 66vw, 34vh);
    aspect-ratio: 1;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    transition: scale 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
    touch-action: manipulation;
  }
  .gift:disabled {
    cursor: default;
  }
  .gift svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .gift.idle {
    animation: wiggle 3s ease-in-out infinite;
  }
  .pop-out {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: popout 0.7s cubic-bezier(0.3, 1.6, 0.5, 1) 0.25s both, floaty 3s ease-in-out 1s infinite;
  }
  @keyframes popout {
    from {
      transform: translateY(50px) scale(0.2);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }
  @keyframes floaty {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }
  .gift.rattle {
    animation: rattle var(--s) linear infinite;
  }
  @keyframes rattle {
    0%,
    100% {
      transform: translate(0, 0) rotate(0);
    }
    25% {
      transform: translate(calc(var(--a) * -1), calc(var(--a) * 0.3)) rotate(calc(var(--r) * -1));
    }
    50% {
      transform: translate(var(--a), calc(var(--a) * -0.3)) rotate(var(--r));
    }
    75% {
      transform: translate(calc(var(--a) * -0.5), 0) rotate(calc(var(--r) * 0.5));
    }
  }
  .tap-hint {
    position: absolute;
    right: 0;
    bottom: 34px;
    display: flex;
    align-items: flex-start;
    gap: 4px;
    pointer-events: none;
  }
  .tap-hint svg {
    width: 56px;
  }
  .tap-hint span {
    font-size: 28px;
    color: var(--pink-dark);
    margin-top: 30px;
    white-space: nowrap;
  }
  .tap-hint span.loud {
    font-size: 30px;
    color: #b0244d;
  }
  .meter {
    position: absolute;
    bottom: 0;
    display: flex;
    gap: 8px;
  }
  .meter span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: #fff;
    transition: background 0.2s, transform 0.2s;
  }
  .meter span.on {
    background: var(--pink);
    transform: scale(1.15);
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    z-index: 15;
    pointer-events: none;
  }
  .foot {
    min-height: 64px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .muted {
    font-size: 14px;
    color: var(--muted-2);
  }
</style>
