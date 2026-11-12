<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { KARTU_DOA } from '../doa'
  import { sfx } from '../lib/audio'
  import { burst } from '../lib/fx'

  // Kartu doa dari kapsul: muncul tertutup, lalu terbalik sendiri memperlihatkan isinya.
  let { index, onclose }: { index: number; onclose: () => void } = $props()
  const kartu = $derived(KARTU_DOA[index])
  const LABEL = { common: 'Kartu Doa', rare: 'RARE!', legendary: 'LEGENDARY!' } as const
  const TAG = { common: 'COMMON', rare: 'RARE', legendary: 'LEGENDARY' } as const
  let revealed = $state(false)

  onMount(() => {
    const t = setTimeout(() => {
      revealed = true
      if (kartu.rarity !== 'common') {
        sfx.tada()
        burst({ big: kartu.rarity === 'legendary', y: 0.45 })
      } else sfx.pop()
    }, 700)
    return () => clearTimeout(t)
  })
</script>

<div class="overlay overlay-fixed {kartu.rarity}" role="dialog" aria-modal="true" aria-labelledby="doa-t" transition:fade={{ duration: 200 }}>
  <div class="title">
    <h2 id="doa-t" class="hand">{revealed ? LABEL[kartu.rarity] : 'Apa isinya ya…'}</h2>
    <p>Kartu {index + 1} dari {KARTU_DOA.length}</p>
  </div>

  <div class="stagec">
    <div class="card3d" class:revealed>
      <div class="face cover" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="#F6D58E" stroke="#23408E" stroke-width="1.2"><path d="M12 2 C12.6 8 14 10.6 22 12 C14 13.4 12.6 16 12 22 C11.4 16 10 13.4 2 12 C10 10.6 11.4 8 12 2Z" /></svg>
      </div>
      <div class="face front">
        <span class="tag">{TAG[kartu.rarity]}</span>
        <p class="hand">{kartu.teks}</p>
        <svg class="deco" aria-hidden="true" viewBox="0 0 40 40" width="34" height="34" stroke="#23408E" stroke-width="2"><path d="M4 14 C4 4 16 0 20 10 C24 0 36 4 36 14 C36 28 20 38 20 38 C20 38 4 28 4 14 Z" fill="#F28AA5" /></svg>
      </div>
    </div>
  </div>

  <button class="btn" onclick={onclose} disabled={!revealed}>Simpan ke album</button>
</div>

<style>
  .overlay {
    z-index: 30;
    background: var(--arcade-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(72px + var(--safe-top)) 22px calc(24px + var(--safe-bottom));
  }
  .overlay.legendary {
    background: #fff8dc;
  }
  .title {
    text-align: center;
  }
  h2 {
    font-size: 52px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .legendary h2 {
    color: #9a6a08;
  }
  .title p {
    font-size: 15px;
    font-weight: 800;
  }
  .stagec {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    perspective: 1200px;
  }
  .card3d {
    position: relative;
    width: min(280px, 76%);
    aspect-ratio: 3 / 4;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transform: rotateY(180deg) rotate(-2deg);
    transition: transform 0.7s cubic-bezier(0.3, 1.3, 0.5, 1);
  }
  .card3d.revealed {
    transform: rotateY(0) rotate(-2deg);
  }
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border: 2.5px solid var(--ink);
    border-radius: 18px;
    box-shadow: 6px 6px 0 var(--ink);
  }
  .cover {
    transform: rotateY(180deg);
    background-color: #ffc9d9;
    background-image: radial-gradient(#fff 3px, transparent 3.5px);
    background-size: 22px 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .front {
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 34px 22px;
    gap: 14px;
    text-align: center;
  }
  .rare .front {
    background: #ece4ff;
  }
  .legendary .front {
    background: #fff4cc;
    border-color: #9a6a08;
    box-shadow:
      6px 6px 0 #9a6a08,
      0 0 0 8px rgba(246, 213, 142, 0.6),
      0 0 40px 10px rgba(246, 213, 142, 0.7);
  }
  .front p {
    font-size: 26px;
    line-height: 1.3;
    color: var(--ink);
  }
  .tag {
    padding: 4px 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .rare .tag {
    background: var(--lilac);
  }
  .legendary .tag {
    background: var(--butter);
  }
  .deco {
    position: absolute;
    right: -12px;
    bottom: -12px;
    rotate: 12deg;
  }
  .btn {
    width: 100%;
    flex-shrink: 0;
  }
</style>
