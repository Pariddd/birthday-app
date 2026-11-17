<script lang="ts">
  import { config } from '../config'
  import { sesi, type Role } from '../lib/ruang.svelte'

  // Foto profil bulat; kalau belum dipasang, tampil inisial berwarna.
  let { role, size = 32 }: { role: Role; size?: number } = $props()
  const nama = $derived(role === 'dilla' ? config.nama : config.pengirim)
  const p = $derived(sesi.profil[role])
  let gagal = $state(false)
  $effect(() => {
    void p?.src
    gagal = false
  })
</script>

<span class="av" class:dilla={role === 'dilla'} style="--s:{size}px" title={nama}>
  {#if p && !gagal}
    <img src={p.src} alt="" loading="lazy" decoding="async" onerror={() => (gagal = true)} />
  {:else}
    <span aria-hidden="true">{nama.charAt(0).toUpperCase()}</span>
  {/if}
</span>

<style>
  .av {
    width: var(--s);
    height: var(--s);
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: #cfe6f7;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--hand);
    font-weight: 700;
    font-size: calc(var(--s) * 0.6);
    line-height: 1;
    color: var(--ink);
  }
  .av.dilla {
    background: var(--pink-soft);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
