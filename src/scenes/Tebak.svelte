<script lang="ts">
  import { config } from '../config'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Photo from '../components/Photo.svelte'
  import Icon from '../components/Icon.svelte'

  const rounds = config.tebakFoto
  let round = $state(0)
  let stars = $state(3)
  let total = $state(0)
  let picked = $state<number | null>(null)
  let wrong = $state<number[]>([])
  let finished = $state(false)

  const q = $derived(rounds[round])
  const blur = $derived(picked !== null ? 0 : [24, 16, 8, 3][3 - stars])

  function clearer() {
    if (stars > 1 && picked === null) {
      stars--
      sfx.tap()
    }
  }

  function answer(i: number) {
    if (picked !== null || wrong.includes(i)) return
    if (i === q.benar) {
      picked = i
      total += stars
      sfx.tada()
      burst({ y: 0.4 })
    } else {
      wrong = [...wrong, i]
      sfx.wrong()
      vibrate(60)
      stars = Math.max(1, stars - 1)
    }
  }

  function next() {
    if (round === rounds.length - 1) {
      finished = true
      return
    }
    round++
    stars = 3
    picked = null
    wrong = []
  }

  function restart() {
    round = 0
    stars = 3
    total = 0
    picked = null
    wrong = []
    finished = false
  }
</script>

<section class="scene arcade">
  <ArcadeHeader title="Tebak Foto" />

  {#if finished}
    <div class="end">
      <p class="hand big">{total} bintang!</p>
      <p>dari maksimal {rounds.length * 3}. {total >= rounds.length * 2 ? 'Kamu inget semuanya ya.' : 'Nggak apa-apa, kenangannya tetap kita yang punya.'}</p>
      <button class="btn" onclick={restart}>Main lagi</button>
    </div>
  {:else}
    <div class="photo">
      <div class="blur" style="filter: blur({blur}px)"><Photo src={config.foto[q.foto].src} alt="Foto yang harus ditebak" label="[FOTO BLUR]" /></div>
      <span class="round">{round + 1}/{rounds.length}</span>
    </div>

    <div class="bar">
      <div class="stars" aria-label="Sisa {stars} bintang">
        {#each [0, 1, 2] as s (s)}<span class:dim={s >= stars}><Icon name="star" size={24} stroke={1.6} /></span>{/each}
      </div>
      <button class="chip clear" onclick={clearer} disabled={stars <= 1 || picked !== null}><Icon name="eye" size={18} /> Perjelas (−1 bintang)</button>
    </div>

    <h2 class="hand">Ini momen apa?</h2>
    <div class="answers">
      {#each q.pilihan as p, i (i)}
        <button class="ans" class:right={picked === i} class:bad={wrong.includes(i)} onclick={() => answer(i)} disabled={picked !== null && picked !== i}>
          <span class="key" style="background:{['#FFC9D9', '#CDEFE3', '#CFE6F7'][i]}">{'ABC'[i]}</span>{p}
        </button>
      {/each}
    </div>

    {#if picked !== null}
      <button class="btn next" onclick={next}>{round === rounds.length - 1 ? 'Lihat skor' : 'Foto berikutnya'} <Icon name="next" /></button>
    {/if}
  {/if}
</section>

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .photo {
    position: relative;
    height: min(300px, 34vh);
    flex-shrink: 0;
    border: 2.5px solid var(--ink);
    border-radius: 20px;
    overflow: hidden;
    background: #eef3fb;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .blur {
    position: absolute;
    inset: -30px;
    transition: filter 0.6s;
  }
  .round {
    position: absolute;
    right: 10px;
    top: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #fff;
    border: 2px solid var(--ink);
    font-size: 12px;
    font-weight: 800;
  }
  .bar {
    margin-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .stars {
    display: flex;
    gap: 6px;
  }
  .stars .dim {
    opacity: 0.25;
    filter: grayscale(1);
  }
  .clear {
    height: 44px;
    background: #fff4cc;
    cursor: pointer;
  }
  .clear:disabled {
    opacity: 0.5;
    cursor: default;
  }
  h2 {
    margin-top: 18px;
    font-size: 34px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .answers {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ans {
    width: 100%;
    min-height: 54px;
    padding: 8px 16px;
    border: 2.5px solid var(--ink);
    border-radius: var(--r-sketch);
    background: #fff;
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 800;
    font-size: 16px;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .ans.right {
    background: #cdefe3;
  }
  .ans.bad {
    background: #ffe3ea;
    text-decoration: line-through;
    opacity: 0.7;
  }
  .ans:disabled:not(.right) {
    opacity: 0.5;
  }
  .key {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
  }
  .next {
    margin-top: 18px;
    flex-shrink: 0;
  }
  .end {
    margin: auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    font-size: 16px;
    line-height: 1.5;
    color: var(--muted);
  }
  .big {
    font-size: 64px;
    color: var(--pink-dark);
    line-height: 1;
  }
</style>
