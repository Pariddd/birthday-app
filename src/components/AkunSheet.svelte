<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, type Role } from '../lib/ruang.svelte'
  import { game } from '../lib/state.svelte'
  import NotifToggle from './NotifToggle.svelte'
  import Icon from './Icon.svelte'

  let { onclose }: { onclose: () => void } = $props()
  let ganti = $state(false)
  let oldPin = $state('')
  let pin = $state('')
  let busy = $state(false)
  let error = $state('')
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  async function gantiPin(e: Event) {
    e.preventDefault()
    error = ''
    if (!/^\d{4,8}$/.test(pin)) return (error = 'PIN baru harus 4–8 angka.')
    busy = true
    try {
      const r = await api<{ token: string; role: Role }>('auth', { body: { action: 'changePin', oldPin, pin } })
      await sesi.login(r.token, r.role)
      game.say('PIN baru tersimpan.')
      ganti = false
      oldPin = pin = ''
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Gagal'
    } finally {
      busy = false
    }
  }

  async function resetPin() {
    if (!confirm(`Reset PIN ${config.nama}? Dia harus bikin PIN baru, dan semua perangkatnya keluar. Surat & foto tetap aman.`)) return
    try {
      await api('auth', { body: { action: 'resetPin' } })
      game.say(`PIN ${config.nama} direset.`)
    } catch (err) {
      game.say(err instanceof ApiError ? err.message : 'Gagal')
    }
  }

  function keluar() {
    sesi.logout()
    game.say('Sudah keluar dari Ruang Kita di perangkat ini.')
    onclose()
  }
</script>

<div class="back overlay-fixed" role="presentation" onclick={onclose} transition:fade={{ duration: 150 }}></div>
<div class="sheet overlay-fixed" role="dialog" aria-modal="true" aria-labelledby="akun-t" transition:fly={{ y: 300, duration: 260 }}>
  <div class="head">
    <h3 id="akun-t" class="hand">Ruang Kita</h3>
    <button class="icon-btn" aria-label="Tutup" onclick={onclose}><Icon name="close" /></button>
  </div>
  <p class="who"><Icon name="user" size={16} /> Masuk sebagai <b>{sesi.role === 'parid' ? config.pengirim : config.nama}</b></p>

  <NotifToggle full />

  {#if sesi.role === 'dilla'}
    {#if !ganti}
      <button class="btn ghost" onclick={() => (ganti = true)}><Icon name="lock" /> Ganti PIN</button>
    {:else}
      <form class="ganti" onsubmit={gantiPin}>
        <input type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN lama" maxlength="8" value={oldPin} oninput={(e) => (oldPin = digits(e.currentTarget.value))} />
        <input type="password" inputmode="numeric" autocomplete="new-password" placeholder="PIN baru (4–8 angka)" maxlength="8" value={pin} oninput={(e) => (pin = digits(e.currentTarget.value))} />
        {#if error}<p class="err" role="alert">{error}</p>{/if}
        <div class="acts">
          <button type="button" class="btn ghost" onclick={() => (ganti = false)}>Batal</button>
          <button class="btn pink grow" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan PIN baru'}</button>
        </div>
      </form>
    {/if}
    <p class="note">Progres game (foto yang sudah dicapit, rekor, koin) ikut tersimpan di cloud, jadi aman kalau ganti HP.</p>
  {:else}
    <button class="btn ghost" onclick={resetPin}><Icon name="refresh" /> Reset PIN {config.nama}</button>
    <p class="note">Pakai kalau {config.nama} lupa PIN, atau kalau ada yang bikin PIN sebelum dia.</p>
  {/if}

  <button class="out" onclick={keluar}>Keluar dari perangkat ini</button>
</div>

<style>
  .back {
    z-index: 70;
    background: rgba(22, 40, 90, 0.4);
  }
  .sheet {
    z-index: 71;
    top: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--paper);
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 18px 20px calc(20px + var(--safe-bottom));
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    font-size: 36px;
    color: var(--pink-dark);
    line-height: 1;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
  }
  .ganti {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ganti input {
    height: 48px;
    padding: 0 14px;
    border: 2.5px solid var(--ink);
    border-radius: 14px;
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 4px;
  }
  .acts {
    display: flex;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .note {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted-2);
    line-height: 1.45;
  }
  .out {
    min-height: 44px;
    border: none;
    background: none;
    color: var(--pink-dark);
    font-weight: 800;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
