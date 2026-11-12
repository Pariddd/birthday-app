<script lang="ts">
  import { game, type SceneId } from '../lib/state.svelte'
  import Icon from './Icon.svelte'

  let { title, back = 'arcade', coins = false }: { title: string; back?: SceneId; coins?: boolean } = $props()
</script>

<header>
  <button class="icon-btn" aria-label="Kembali" onclick={() => game.go(back)}><Icon name="back" /></button>
  <h1 class="hand">{title}</h1>
  {#if coins}
    <span class="coins" aria-label="{game.coins} koin"><Icon name="coin" size={24} stroke={1.8} /> {game.coins}</span>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  h1 {
    flex: 1;
    font-size: clamp(32px, 9.5vw, 40px);
    line-height: 1;
  }
  .coins {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 14px 0 8px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff4cc;
    font-weight: 900;
    font-size: 18px;
  }
</style>
