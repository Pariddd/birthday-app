<script lang="ts">
  import { onDestroy } from 'svelte'
  import { config } from '../config'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Photo from '../components/Photo.svelte'
  import Icon from '../components/Icon.svelte'

  type Card = { id: number; photo: number; open: boolean; matched: boolean }

  function deal(): Card[] {
    const ids = [...config.fotoMemory, ...config.fotoMemory]
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    return ids.map((photo, id) => ({ id, photo, open: false, matched: false }))
  }

  let cards = $state<Card[]>(deal())
  let moves = $state(0)
  let seconds = $state(0)
  let lock = false
  let started = false
  let tick: ReturnType<typeof setInterval> | undefined

  const pairs = $derived(cards.filter((c) => c.matched).length / 2)
  const won = $derived(pairs === config.fotoMemory.length)
  const time = $derived(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)

  function flip(c: Card) {
    if (lock || c.open || c.matched || won) return
    if (!started) {
      started = true
      tick = setInterval(() => seconds++, 1000)
    }
    c.open = true
    sfx.tap()
    const opened = cards.filter((x) => x.open && !x.matched)
    if (opened.length === 2) {
      moves++
      const [a, b] = opened
      if (a.photo === b.photo) {
        a.matched = b.matched = true
        sfx.pop()
        vibrate(20)
        if (cards.every((x) => x.matched)) {
          clearInterval(tick)
          sfx.tada()
          burst({ big: true })
        }
      } else {
        lock = true
        setTimeout(() => {
          a.open = b.open = false
          lock = false
        }, 850)
      }
    }
  }

  function again() {
    clearInterval(tick)
    cards = deal()
    moves = 0
    seconds = 0
    started = false
  }

  onDestroy(() => clearInterval(tick))
</script>

<section class="scene arcade">
  <ArcadeHeader title="Memory Match" />

  <div class="stats">
    <div><span>Langkah</span><b>{moves}</b></div>
    <div class="mint"><span>Pasangan</span><b>{pairs}/{config.fotoMemory.length}</b></div>
    <div><span>Waktu</span><b>{time}</b></div>
  </div>

  <div class="board">
    {#each cards as c (c.id)}
      <button class="card" class:open={c.open || c.matched} class:matched={c.matched} onclick={() => flip(c)} aria-label={c.open || c.matched ? `Kartu ${c.id + 1}, foto ${c.photo + 1}${c.matched ? ', sudah cocok' : ''}` : `Kartu ${c.id + 1}, tertutup`}>
        <span class="inner">
          <span class="face back"><Icon name="star" size={30} stroke={1.6} /></span>
          <span class="face front">
            <Photo src={config.foto[c.photo].src} alt="" label="[{c.photo + 1}]" />
            {#if c.matched}<span class="tick"><Icon name="check" size={12} color="#fff" stroke={4} /></span>{/if}
          </span>
        </span>
      </button>
    {/each}
  </div>

  <p class="hand msg">
    {#if won}Hebat! {moves} langkah, {time}. Ingatanmu masih bagus ternyata.{:else if pairs === config.fotoMemory.length - 1}Satu lagi… pasangannya di mana ya?{:else}Balik dua kartu, cari foto yang sama.{/if}
  </p>

  <button class="btn ghost" onclick={again}>{won ? 'Main lagi' : 'Acak ulang'}</button>
</section>

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .stats div {
    padding: 10px;
    border: 2px solid var(--ink);
    border-radius: 14px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stats .mint {
    background: #cdefe3;
  }
  .stats span {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .stats b {
    font-size: 22px;
    font-weight: 900;
  }
  .board {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    perspective: 900px;
  }
  .card {
    aspect-ratio: 3 / 4.2;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .inner {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.45s cubic-bezier(0.3, 1.3, 0.5, 1);
  }
  .card.open .inner {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    box-shadow: 3px 3px 0 var(--ink);
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .back {
    background-color: #ffc9d9;
    background-image: radial-gradient(#fff 2px, transparent 2.5px);
    background-size: 14px 14px;
  }
  .front {
    transform: rotateY(180deg);
    background: #eef3fb;
  }
  .matched .front {
    opacity: 0.6;
  }
  .tick {
    position: absolute;
    right: 5px;
    top: 5px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #3a8f7d;
    border: 2px solid var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .msg {
    margin: 22px 0 18px;
    text-align: center;
    font-size: 27px;
    line-height: 1.15;
    color: var(--pink-dark);
  }
  .btn {
    margin-top: auto;
    flex-shrink: 0;
  }
</style>
