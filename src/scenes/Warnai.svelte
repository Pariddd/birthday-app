<script lang="ts">
  import { game, type CakeArea } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import Cake, { CRAYONS, type CrayonKey } from '../components/Cake.svelte'

  let pick = $state<CrayonKey>('pink')
  const count = $derived(Object.keys(game.cake).length)
  const keys = Object.keys(CRAYONS) as CrayonKey[]

  function paint(a: CakeArea) {
    game.cake = { ...game.cake, [a]: pick }
    sfx.tap()
    vibrate(10)
    game.save()
  }

  function done() {
    sfx.tada()
    burst({ y: 0.45 })
    setTimeout(() => game.next(), 700)
  }
</script>

<section class="scene">
  <h1 class="hand">Kuenya belum diwarnain…</h1>
  <div class="row">
    <p>Pilih krayon, terus ketuk bagian kuenya.</p>
    <span class="chip">{count}/5 bagian</span>
  </div>

  <div class="cake-wrap">
    <Cake colors={game.cake} interactive onpaint={paint} drawIn label="Kue sketsa untuk diwarnai" />
  </div>

  <div class="crayons-wrap">
    <span class="lbl" id="krayon-lbl">Krayon</span>
    <div class="crayons" role="radiogroup" aria-labelledby="krayon-lbl">
      {#each keys as k (k)}
        <button
          class="crayon"
          class:on={pick === k}
          role="radio"
          aria-checked={pick === k}
          aria-label="Krayon {CRAYONS[k].label}"
          onclick={() => {
            pick = k
            sfx.tap()
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 26 80" fill={CRAYONS[k].line} stroke="#23408E" stroke-width={pick === k ? 2.4 : 2} stroke-linejoin="round">
            <path d="M4 18 L22 18 L22 78 L4 78 Z" /><path d="M4 18 L13 2 L22 18 Z" /><path d="M4 30 H22 M4 66 H22" fill="none" />
          </svg>
        </button>
      {/each}
    </div>
  </div>

  <div class="actions">
    <button class="btn ghost" onclick={() => { game.cake = {}; game.save() }} disabled={count === 0}>Hapus warna</button>
    <button class="btn grow" onclick={done} disabled={count < 3}>Kuenya jadi!</button>
  </div>
</section>

<style>
  h1 {
    font-size: clamp(36px, 10.5vw, 42px);
    line-height: 1;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .row p {
    font-size: 15px;
    line-height: 1.4;
    color: var(--muted);
  }
  .cake-wrap {
    flex: 1;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -16px;
  }
  .cake-wrap :global(svg) {
    max-height: 36vh;
    width: auto;
    max-width: 100%;
  }
  .lbl {
    font-size: 13px;
    font-weight: 800;
    color: var(--muted);
  }
  .crayons {
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 12px 10px 8px;
    border: 2px solid var(--ink);
    border-radius: var(--r-sketch);
    background: #fff;
  }
  .crayon {
    width: 44px;
    height: 84px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    transition: transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  .crayon svg {
    width: 24px;
    height: 72px;
  }
  .crayon.on {
    transform: translateY(-14px);
  }
  .actions {
    display: flex;
    gap: 12px;
    margin-top: 18px;
  }
  .actions .btn {
    flex: 1;
    padding: 0 10px;
    font-size: 15px;
    white-space: nowrap;
  }
  .actions .grow {
    flex: 1.4;
  }
</style>
