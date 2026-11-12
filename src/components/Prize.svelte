<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import gsap from 'gsap'
  import { config } from '../config'
  import { reducedMotion } from '../lib/state.svelte'
  import Photo from './Photo.svelte'
  import Icon from './Icon.svelte'

  let { index, onclose }: { index: number; onclose: () => void } = $props()
  const foto = $derived(config.foto[index] as (typeof config.foto)[number] & { legendary?: boolean })
  let flipped = $state(false)
  let root: HTMLDivElement

  onMount(() => {
    if (reducedMotion) return
    gsap
      .timeline()
      .from(root.querySelector('.frame'), { scale: 0.2, rotate: -30, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' })
      .from(root.querySelectorAll('.sticker'), { scale: 0, opacity: 0, duration: 0.35, ease: 'back.out(3)', stagger: 0.15 }, '-=0.1')
      .from(root.querySelectorAll('.burst-line'), { opacity: 0, duration: 0.4 }, 0)
  })
</script>

<div class="overlay" bind:this={root} role="dialog" aria-modal="true" aria-labelledby="prize-t" transition:fade={{ duration: 200 }}>
  <svg class="rays" aria-hidden="true" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" fill="none" stroke={foto.legendary ? '#F6D58E' : '#C3B1F0'} stroke-width="3" stroke-linecap="round">
    <path class="burst-line" d="M195 420 L195 120 M195 420 L340 160 M195 420 L380 330 M195 420 L370 560 M195 420 L300 720 M195 420 L90 720 M195 420 L20 560 M195 420 L10 330 M195 420 L50 160" />
  </svg>

  <div class="title">
    <h2 id="prize-t" class="hand">{foto.legendary ? 'LEGENDARY!' : 'Dapet!'}</h2>
    <p>Foto {index + 1} dari {config.foto.length}</p>
  </div>

  <div class="stagec">
    <button class="frame" class:flipped class:legendary={foto.legendary} onclick={() => (flipped = !flipped)} aria-label={flipped ? 'Lihat foto' : 'Balik foto untuk baca tulisannya'}>
      <div class="face front">
        <div class="photo"><Photo src={foto.src} alt="Foto kenangan {index + 1}" label="[FOTO {index + 1}]" /></div>
      </div>
      <div class="face back">
        <p class="hand">{foto.caption}</p>
      </div>
    </button>
    <span class="tag" class:gold={foto.legendary}>{foto.legendary ? 'LEGENDARY' : 'LANGKA'}</span>
    <svg class="sticker s1" aria-hidden="true" viewBox="0 0 30 30" stroke="#23408E" stroke-width="2" stroke-linejoin="round"><path d="M15 2 l4 9 10 1 -8 7 2 10 -8 -5 -8 5 2 -10 -8 -7 10 -1z" fill="#F6D58E" /></svg>
    <svg class="sticker s2" aria-hidden="true" viewBox="0 0 40 40" stroke="#23408E" stroke-width="2" stroke-linejoin="round"><path d="M4 14 C4 4 16 0 20 10 C24 0 36 4 36 14 C36 28 20 38 20 38 C20 38 4 28 4 14 Z" fill="#F28AA5" /></svg>
    <svg class="sticker s3" aria-hidden="true" viewBox="0 0 24 24" stroke="#23408E" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2 C12.6 8 14 10.6 22 12 C14 13.4 12.6 16 12 22 C11.4 16 10 13.4 2 12 C10 10.6 11.4 8 12 2Z" fill="#9CCBF0" /></svg>
  </div>

  <p class="hint hand">{flipped ? 'ketuk lagi untuk lihat fotonya' : 'ada tulisan di belakangnya…'}</p>

  <div class="actions">
    <button class="btn ghost" onclick={() => (flipped = !flipped)}><Icon name="flip" /> Balik foto</button>
    <button class="btn grow" onclick={onclose}>Simpan ke album</button>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: var(--arcade-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(72px + var(--safe-top)) 22px calc(24px + var(--safe-bottom));
    overflow: hidden;
  }
  .rays {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .title {
    position: relative;
    text-align: center;
  }
  h2 {
    font-size: 58px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .title p {
    font-size: 15px;
    font-weight: 800;
  }
  .stagec {
    position: relative;
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    perspective: 1200px;
    min-height: 300px;
  }
  .frame {
    position: relative;
    width: min(270px, 72%, 34vh);
    aspect-ratio: 3 / 4;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.3, 1.3, 0.5, 1);
    rotate: -3deg;
  }
  .frame.flipped {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border: 2.5px solid var(--ink);
    box-shadow: 5px 5px 0 var(--ink);
  }
  .front {
    padding: 22px;
    background-color: #fff;
    background-image: conic-gradient(#f28aa5 25%, transparent 0 50%, #f28aa5 0 75%, transparent 0);
    background-size: 28px 28px;
  }
  .legendary .front {
    background-image: conic-gradient(#f2b84b 25%, transparent 0 50%, #f2b84b 0 75%, transparent 0);
    box-shadow:
      5px 5px 0 var(--ink),
      0 0 0 6px #fff4cc;
  }
  .photo {
    width: 100%;
    height: 100%;
    border: 2.5px solid var(--ink);
    overflow: hidden;
    background: #eef3fb;
  }
  .back {
    transform: rotateY(180deg);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .back p {
    font-size: 25px;
    line-height: 1.3;
    color: var(--ink);
    text-align: center;
  }
  .tag {
    position: absolute;
    top: calc(50% - min(180px, 23vh) - 6px);
    right: 14%;
    padding: 5px 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--lilac);
    font-size: 13px;
    font-weight: 900;
    rotate: 6deg;
  }
  .tag.gold {
    background: #f6d58e;
  }
  .sticker {
    position: absolute;
  }
  .s1 {
    width: 40px;
    left: 10%;
    top: 14%;
  }
  .s2 {
    width: 40px;
    right: 8%;
    bottom: 20%;
  }
  .s3 {
    width: 30px;
    left: 8%;
    bottom: 26%;
  }
  .hint {
    position: relative;
    font-size: 23px;
    font-weight: 500;
    color: var(--muted);
    margin: 8px 0 16px;
  }
  .actions {
    position: relative;
    display: flex;
    gap: 12px;
    width: 100%;
  }
  .actions .btn {
    flex: 1;
    padding: 0 10px;
    font-size: 16px;
  }
  .actions .grow {
    flex: 1.3;
  }
</style>
