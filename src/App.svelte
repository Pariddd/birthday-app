<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import { game, SCENES, reducedMotion, type SceneId } from './lib/state.svelte'
  import { setMuted, startMusic } from './lib/audio'
  import Icon from './components/Icon.svelte'
  import Toast from './components/Toast.svelte'
  import Kunci from './scenes/Kunci.svelte'
  import Kado from './scenes/Kado.svelte'
  import Umur from './scenes/Umur.svelte'
  import Warnai from './scenes/Warnai.svelte'
  import Sparkler from './scenes/Sparkler.svelte'
  import Lilin from './scenes/Lilin.svelte'
  import Surat from './scenes/Surat.svelte'
  import Arcade from './scenes/Arcade.svelte'
  import Claw from './scenes/Claw.svelte'
  import Album from './scenes/Album.svelte'
  import Photobooth from './scenes/Photobooth.svelte'
  import Memory from './scenes/Memory.svelte'
  import Tebak from './scenes/Tebak.svelte'
  import Lari from './scenes/Lari.svelte'
  import Buket from './scenes/Buket.svelte'

  const VIEWS = {
    kunci: Kunci,
    kado: Kado,
    umur: Umur,
    warnai: Warnai,
    sparkler: Sparkler,
    lilin: Lilin,
    buket: Buket,
    surat: Surat,
    arcade: Arcade,
    claw: Claw,
    album: Album,
    photobooth: Photobooth,
    memory: Memory,
    tebak: Tebak,
    lari: Lari,
  }

  // Mode uji (hanya saat `npm run dev`): ?scene=lilin langsung lompat ke scene tsb.
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search)
    const s = q.get('scene') as SceneId | null
    if (s && s in VIEWS) {
      game.unlocked = true
      if (q.has('finished')) game.finished = true
      game.scene = s
    }
  }

  // Lanjut dari progres tersimpan: musik baru boleh mulai setelah ketukan pertama.
  const resumed = game.unlocked && game.scene !== 'kado'
  function firstTap() {
    if (resumed) startMusic()
  }

  const isArcade = $derived(['arcade', 'claw', 'album', 'photobooth', 'memory', 'tebak', 'lari'].includes(game.scene))
  const showChrome = $derived(game.scene !== 'kunci')
  const Current = $derived(VIEWS[game.scene])
  const dur = reducedMotion ? 0 : 450
</script>

<svelte:window onpointerdown={firstTap} />

<main class="stage" class:arcade={isArcade} class:paper={!isArcade}>
  {#key game.scene}
    <div class="view" in:fly={{ y: 24, duration: dur, delay: dur * 0.6 }} out:fade={{ duration: dur * 0.6 }}>
      <Current />
    </div>
  {/key}

  {#if showChrome}
    <div class="topbar">
      <div class="left">
        {#if game.finished}
          <button class="icon-btn" aria-label="Daftar isi" onclick={() => (game.menuOpen = true)}>
            <Icon name="menu" />
          </button>
        {/if}
      </div>
      <div class="right">
        {#if game.secrets.length > 0 || ['lilin', 'album', 'arcade'].includes(game.scene)}
          <span class="chip" aria-label="Pesan rahasia ditemukan {game.secrets.length} dari 3">
            <Icon name="star" size={14} stroke={1.8} />
            rahasia {game.secrets.length}/3
          </span>
        {/if}
        <button class="icon-btn" aria-label={game.muted ? 'Nyalakan suara' : 'Matikan suara'} onclick={() => setMuted(!game.muted)}>
          <Icon name={game.muted ? 'mute' : 'sound'} />
        </button>
      </div>
    </div>
  {/if}

  {#if game.menuOpen}
    <div class="backdrop" role="presentation" onclick={() => (game.menuOpen = false)} transition:fade={{ duration: 150 }}></div>
    <div class="sheet paper" role="dialog" aria-modal="true" aria-labelledby="menu-title" transition:fly={{ y: 300, duration: 300 }}>
      <div class="sheet-head">
        <h2 id="menu-title" class="hand">Daftar isi</h2>
        <button class="icon-btn" aria-label="Tutup" onclick={() => (game.menuOpen = false)}><Icon name="close" /></button>
      </div>
      <ol>
        {#each SCENES.slice(1) as s, i (s.id)}
          <li>
            <button class="item" class:active={game.scene === s.id} onclick={() => game.go(s.id)}>
              <span class="num">{i + 1}</span>{s.judul}
            </button>
          </li>
        {/each}
      </ol>
      <button class="reset" onclick={() => confirm('Mulai dari awal? Foto & koin yang sudah dikumpulkan akan hilang.') && game.reset()}>Mulai dari awal</button>
    </div>
  {/if}

  <Toast />
</main>

<style>
  .stage {
    position: relative;
    width: 100%;
    max-width: 480px;
    height: 100%;
    overflow: hidden;
    transition: background-color 0.5s;
  }
  .stage.arcade {
    background: var(--arcade-bg);
  }
  @media (min-width: 560px) {
    .stage {
      border-left: 2.5px solid var(--ink);
      border-right: 2.5px solid var(--ink);
      box-shadow:
        8px 0 0 rgba(35, 64, 142, 0.12),
        -8px 0 0 rgba(35, 64, 142, 0.12);
    }
  }
  .view {
    position: absolute;
    inset: 0;
  }
  .topbar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    padding: calc(14px + var(--safe-top)) 14px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
    z-index: 20;
  }
  .topbar > div {
    display: flex;
    gap: 8px;
    align-items: center;
    pointer-events: auto;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(22, 40, 90, 0.35);
    z-index: 40;
  }
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 86%;
    overflow-y: auto;
    z-index: 41;
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 18px 20px calc(20px + var(--safe-bottom)) 46px;
  }
  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .sheet h2 {
    font-size: 38px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .item {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    border: 2px solid transparent;
    border-radius: 12px;
    background: transparent;
    font-weight: 800;
    font-size: 16px;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
  }
  .item:hover,
  .item.active {
    border-color: var(--ink);
    background: #fff;
  }
  .num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: var(--pink-soft);
    flex-shrink: 0;
  }
  .reset {
    margin-top: 14px;
    border: none;
    background: none;
    color: var(--pink-dark);
    font-weight: 800;
    text-decoration: underline;
    min-height: 44px;
    cursor: pointer;
  }
</style>
