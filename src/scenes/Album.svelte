<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { longpress } from '../lib/fx'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Photo from '../components/Photo.svelte'
  import Icon from '../components/Icon.svelte'

  const fotos = config.foto as ((typeof config.foto)[number] & { legendary?: boolean })[]
  let open = $state<number | null>(null)
  const tilt = [-3, 2, 1.5, -1.5, -2, 2.5, 1, -2]
</script>

<section class="scene arcade">
  <ArcadeHeader title="Album Kenangan" />
  <div class="progress">
    <div class="bar"><div style="width:{(game.collected.length / fotos.length) * 100}%"></div></div>
    <b>{game.collected.length}/{fotos.length}</b>
  </div>

  <div class="grid">
    {#each fotos as f, i (i)}
      {#if game.collected.includes(i)}
        <button class="pol" class:gold={f.legendary} style="rotate:{tilt[i]}deg" onclick={() => (open = i)} use:longpress={() => game.findSecret(1)} aria-label="Foto {i + 1}: {f.caption}">
          <span class="img"><Photo src={f.src} alt="" label="[FOTO {i + 1}]" /></span>
          <span class="cap hand">{f.caption.length > 22 ? f.caption.slice(0, 20) + '…' : f.caption}</span>
        </button>
      {:else}
        <div class="lock" class:gold={f.legendary} style="rotate:{tilt[i]}deg">
          {#if f.legendary}
            <Icon name="star" size={30} color="#8A6414" stroke={1.6} />
            <b>Legendary</b><small>masih misteri</small>
          {:else}
            <Icon name="lock" size={28} color="#6B6585" stroke={2} />
            <b>belum dapet</b>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  {#if game.collected.length < fotos.length}
    <button class="btn" onclick={() => game.go('claw')}>Capit foto lainnya</button>
  {:else}
    <p class="hint">Ketuk foto untuk lihat penuh</p>
  {/if}

  {#if open !== null}
    <div class="lb-back" role="presentation" onclick={() => (open = null)} transition:fade={{ duration: 150 }}></div>
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Foto {open + 1}" transition:scale={{ start: 0.9, duration: 200 }}>
      <div class="lb-img" class:gold={fotos[open].legendary}><Photo src={fotos[open].src} alt="Foto {open + 1}" label="[FOTO {open + 1}]" /></div>
      <p class="hand">{fotos[open].caption}</p>
      <button class="icon-btn close" aria-label="Tutup" onclick={() => (open = null)}><Icon name="close" /></button>
    </div>
  {/if}
</section>

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .bar {
    flex: 1;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: #f28aa5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 20px;
    row-gap: 16px;
    padding: 0 8px 20px;
  }
  .pol,
  .lock {
    aspect-ratio: 1 / 1.05;
  }
  .pol {
    padding: 8px 8px 0;
    background: #fff;
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .pol.gold {
    border-color: #8a6414;
    background: #fff4cc;
    box-shadow:
      3px 3px 0 var(--ink),
      0 0 0 4px #f6d58e;
  }
  .img {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: #eef3fb;
  }
  .cap {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lock {
    border: 2px dashed #8e87a8;
    border-radius: 6px;
    background: #eae2fa;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: #5a5478;
  }
  .lock.gold {
    border: 2.5px dashed #c9962a;
    background: #fff4cc;
    color: #7a5510;
  }
  .lock small {
    font-size: 11px;
    font-weight: 700;
  }
  .hint {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #5a5478;
  }
  .btn {
    flex-shrink: 0;
  }
  .lb-back {
    position: absolute;
    inset: 0;
    background: rgba(22, 40, 90, 0.55);
    z-index: 30;
  }
  .lightbox {
    position: absolute;
    left: 18px;
    right: 18px;
    top: 50%;
    translate: 0 -50%;
    z-index: 31;
    background: #fff;
    border: 2.5px solid var(--ink);
    box-shadow: 6px 6px 0 var(--pink);
    padding: 14px 14px 18px;
  }
  .lb-img {
    aspect-ratio: 4 / 5;
    max-height: 58vh;
    width: 100%;
    overflow: hidden;
    border: 2px solid var(--ink);
    background: #eef3fb;
  }
  .lb-img.gold {
    border: 4px solid #f2b84b;
  }
  .lightbox p {
    margin-top: 12px;
    font-size: 24px;
    line-height: 1.3;
    text-align: center;
  }
  .close {
    position: absolute;
    top: -18px;
    right: -10px;
  }
</style>
