<script lang="ts">
  import gsap from 'gsap'
  import { fly } from 'svelte/transition'
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { sfx, startMusic } from '../lib/audio'
  import { burst, draw, vibrate } from '../lib/fx'
  import Icon from '../components/Icon.svelte'

  let opened = $state(false)
  let lid: SVGGElement
  let box: HTMLButtonElement

  function open() {
    if (opened) return
    opened = true
    startMusic()
    sfx.pop()
    vibrate(40)
    const r = box.getBoundingClientRect()
    gsap
      .timeline()
      .to(lid, { y: -24, duration: 0.15, ease: 'power1.out' })
      .to(lid, { y: -260, x: 80, rotate: 35, opacity: 0, duration: 0.7, ease: 'power2.in' })
      .add(() => {
        burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.45) / innerHeight, big: true })
        sfx.tada()
      }, 0.15)
  }
</script>

<section class="scene">
  <div class="head">
    {#if !opened}
      <h1 class="hand">Hai, {config.nama}!</h1>
      <p>Ada yang nungguin kamu dari tadi…</p>
    {:else}
      <h1 class="hand big" in:fly={{ y: 20, duration: 500, delay: 400 }}>Selamat ulang tahun, {config.nama}!</h1>
    {/if}
  </div>

  <div class="gift-area">
    <button class="gift" class:idle={!opened} bind:this={box} onclick={open} aria-label="Buka kado" disabled={opened}>
      <svg viewBox="0 0 220 220" fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" use:draw>
        {#if !opened}
          <path d="M14 120 C8 112 8 100 14 92 M206 118 C212 110 212 98 206 90" stroke-width="2.2" />
        {/if}
        <path d="M40 102 L180 99 L178 198 L42 200 Z" fill="#FBD3DE" />
        <path d="M50 120 L64 108 M50 140 L84 110 M52 162 L98 118 M56 182 L100 142 M70 194 L100 168" stroke="#E0557A" stroke-width="1.4" stroke-opacity="0.6" />
        <path d="M100 100 L121 99 L120 199 L101 200 Z" fill="#F6D58E" />
        {#if opened}
          <path d="M44 104 C60 92 160 92 176 102" stroke-width="2" stroke-opacity="0.5" />
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
        <svg viewBox="0 0 64 56" fill="none" stroke="#C93D66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M58 50 C40 50 18 40 10 12" /><path d="M4 20 L10 10 L18 18" /></svg>
        <span class="hand">ketuk aku!</span>
      </div>
    {/if}
  </div>

  <div class="foot">
    {#if opened}
      <div in:fly={{ y: 20, duration: 400, delay: 1200 }}>
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
    align-items: center;
    justify-content: center;
    min-height: 240px;
  }
  .gift {
    width: min(270px, 70vw, 36vh);
    aspect-ratio: 1;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
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
  .tap-hint {
    position: absolute;
    right: 0;
    bottom: 4%;
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
