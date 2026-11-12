<script lang="ts">
  import { fly } from 'svelte/transition'
  import { game } from '../lib/state.svelte'
</script>

<div class="wrap" aria-live="polite">
  {#if game.toast}
    {#key game.toast.id}
      <div class="toast" transition:fly={{ y: 30, duration: 250 }}>
        <p>{game.toast.text}</p>
      </div>
    {/key}
  {/if}
</div>

<style>
  .wrap {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: calc(96px + var(--safe-bottom));
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 60;
  }
  .toast {
    max-width: 360px;
    padding: 12px 16px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: var(--r-sketch);
    box-shadow: 4px 4px 0 var(--pink);
    transform: rotate(-1deg);
  }
  p {
    font-family: var(--hand);
    font-size: 23px;
    line-height: 1.25;
    color: var(--ink);
    text-align: center;
  }
</style>
