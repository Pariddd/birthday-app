<script lang="ts">
  let { src, alt = '', label = '', style = '' }: { src: string; alt?: string; label?: string; style?: string } = $props()
  let failed = $state(false)
</script>

{#if failed}
  <div class="ph fallback" {style} role="img" aria-label={alt}>
    <span>{label || 'foto belum ada'}</span>
  </div>
{:else}
  <img {src} {alt} {style} draggable="false" loading="lazy" decoding="async" onerror={() => (failed = true)} />
{/if}

<style>
  img,
  .fallback {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
    -webkit-user-drag: none;
  }
  .fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: var(--muted-2);
    text-align: center;
    padding: 6px;
  }
</style>
