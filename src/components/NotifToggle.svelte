<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { pushState, enablePush, disablePush, api, type PushState } from '../lib/ruang.svelte'
  import { game } from '../lib/state.svelte'
  import Icon from './Icon.svelte'

  let { full = false }: { full?: boolean } = $props()
  let st = $state<PushState | 'loading'>('loading')
  let busy = $state(false)
  let guide = $state(false)

  onMount(async () => {
    try {
      st = await pushState()
    } catch {
      st = 'unsupported'
    }
  })

  async function toggle() {
    if (st === 'ios-install') return (guide = true)
    if (busy || st === 'denied' || st === 'unsupported') return
    busy = true
    try {
      if (st === 'on') {
        st = await disablePush()
        game.say('Notifikasi dimatikan di perangkat ini.')
      } else {
        st = await enablePush()
        if (st === 'on') {
          game.say('Notifikasi nyala! Coba cek, harusnya ada notifikasi tes.', 3200)
          void api('push', { body: { action: 'test' } }).catch(() => {})
        } else if (st === 'denied') game.say('Izin notifikasi ditolak. Bisa dinyalakan lagi dari pengaturan browser.', 3600)
        else if (st === 'server-off') game.say('Notifikasi belum disetel di server.', 3000)
      }
    } catch {
      game.say('Gagal menyalakan notifikasi. Coba lagi ya.')
    } finally {
      busy = false
    }
  }

  const label = $derived(
    {
      loading: '…',
      on: 'Notifikasi nyala',
      off: 'Nyalakan notifikasi',
      denied: 'Notifikasi diblokir',
      'ios-install': 'Mau notifikasi?',
      unsupported: 'Notifikasi tidak didukung',
      'server-off': 'Notifikasi belum siap',
    }[st],
  )
</script>

{#if st !== 'unsupported'}
  <button class="chip notif" class:on={st === 'on'} class:full disabled={busy || st === 'loading'} onclick={toggle} aria-pressed={st === 'on'}>
    <Icon name={st === 'on' ? 'bell' : 'bell-off'} size={16} stroke={2} />
    {busy ? 'Sebentar…' : label}
  </button>
  {#if full && st === 'denied'}
    <p class="note">Buka pengaturan situs di browser → Notifikasi → Izinkan, lalu muat ulang.</p>
  {/if}
{/if}

{#if guide}
  <div class="back overlay-fixed" role="presentation" onclick={() => (guide = false)} transition:fade={{ duration: 150 }}></div>
  <div class="sheet overlay-fixed" role="dialog" aria-modal="true" aria-labelledby="ios-t" transition:fly={{ y: 200, duration: 250 }}>
    <h3 id="ios-t" class="hand">Biar notifikasi bisa masuk di iPhone</h3>
    <ol>
      <li>Buka website ini di <b>Safari</b>.</li>
      <li>
        Ketuk tombol <b>Bagikan</b>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1" /></svg>
        di bawah.
      </li>
      <li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>
      <li>Buka <b>Untuk Dilla</b> dari ikon amplop di layar utama, masuk pakai PIN, lalu nyalakan notifikasi.</li>
    </ol>
    <p class="note">Butuh iOS 16.4 ke atas. Di Android/laptop tidak perlu langkah ini.</p>
    <button class="btn" onclick={() => (guide = false)}>Oke, ngerti</button>
  </div>
{/if}

<style>
  .notif {
    cursor: pointer;
    background: #fff;
    min-height: 36px;
  }
  .notif.on {
    background: var(--mint-soft);
  }
  .notif.full {
    width: 100%;
    justify-content: center;
    min-height: 48px;
    font-size: 14px;
    border-radius: 14px;
  }
  .notif:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .note {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted-2);
    line-height: 1.45;
  }
  .back {
    z-index: 80;
    background: rgba(22, 40, 90, 0.4);
  }
  .sheet {
    z-index: 81;
    top: auto;
    background: var(--paper);
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 20px 22px calc(22px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h3 {
    font-size: 30px;
    line-height: 1.05;
    color: var(--pink-dark);
  }
  ol {
    margin: 0;
    padding-left: 22px;
    display: grid;
    gap: 8px;
    font-size: 15px;
    line-height: 1.45;
  }
  ol svg {
    vertical-align: -3px;
  }
</style>
