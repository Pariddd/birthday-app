<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fly } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, type Role } from '../lib/ruang.svelte'
  import { sfx } from '../lib/audio'
  import { vibrate } from '../lib/fx'
  import { game } from '../lib/state.svelte'

  // Pembungkus semua scene "Ruang Kita": tampilkan isinya hanya kalau sudah masuk.
  let { children, alasan }: { children: Snippet; alasan: string } = $props()

  type Mode = 'loading' | 'setup' | 'login' | 'admin' | 'offline'
  let mode = $state<Mode>('loading')
  let pin = $state('')
  let pin2 = $state('')
  let password = $state('')
  let error = $state('')
  let busy = $state(false)
  let shake = $state(false)

  async function cek() {
    mode = 'loading'
    error = ''
    try {
      const s = await api<{ pinSet: boolean; locked: boolean }>('auth')
      mode = s.pinSet ? 'login' : 'setup'
      if (s.locked) error = 'Terlalu banyak salah PIN. Coba lagi sekitar 1 jam lagi ya.'
    } catch (e) {
      mode = 'offline'
      error = e instanceof ApiError ? e.message : 'Server belum bisa dihubungi.'
    }
  }

  $effect(() => {
    if (!sesi.role) void cek()
  })

  function gagal(msg: string) {
    error = msg
    sfx.wrong()
    vibrate(80)
    shake = true
    setTimeout(() => (shake = false), 450)
  }

  async function kirim(e: Event) {
    e.preventDefault()
    if (busy) return
    error = ''
    if (mode === 'setup') {
      if (!/^\d{4,8}$/.test(pin)) return gagal('PIN harus 4–8 angka.')
      if (pin !== pin2) return gagal('PIN-nya beda. Ulangi lagi ya.')
    } else if (mode === 'login' && !/^\d{4,8}$/.test(pin)) return gagal('PIN harus 4–8 angka.')
    busy = true
    try {
      const body =
        mode === 'admin' ? { action: 'admin', password } : { action: mode === 'setup' ? 'setup' : 'login', pin }
      const r = await api<{ token: string; role: Role }>('auth', { body })
      sfx.unlock()
      await sesi.login(r.token, r.role)
      if (r.role === 'dilla') game_say(mode === 'setup' ? 'PIN tersimpan. Jangan kasih tahu siapa-siapa ya!' : `Hai ${config.nama}!`)
      else game_say(`Mode ${config.pengirim} aktif.`)
      pin = pin2 = password = ''
    } catch (err) {
      const ae = err as ApiError
      if (ae.code === 'exists') mode = 'login'
      if (ae.code === 'nopin') mode = 'setup'
      gagal(ae.message)
    } finally {
      busy = false
    }
  }

  const game_say = (t: string) => game.say(t, 2600)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)
</script>

{#if sesi.role}
  {@render children()}
{:else}
  <div class="gate">
    <svg class="pad" aria-hidden="true" viewBox="0 0 120 120" fill="none" stroke="#23408E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M36 54 V40 a24 24 0 0 1 48 0 V54" />
      <rect x="22" y="52" width="76" height="58" rx="14" fill="#FFC9D9" />
      <path d="M60 92 s-13-8-13-17 a7 7 0 0 1 13-3 a7 7 0 0 1 13 3 c0 9-13 17-13 17z" fill="#E0557A" stroke-width="2.4" />
      <path d="M8 22 l5 3 M14 8 l2 6 M106 18 l-5 4 M112 34 l-6 1" stroke="#F28AA5" />
    </svg>
    <h2 class="hand">Ruang Kita</h2>
    <p class="why">{alasan}</p>

    {#if mode === 'loading'}
      <p class="hand wait">sebentar…</p>
    {:else if mode === 'offline'}
      <p class="err" role="alert">{error}</p>
      <button class="btn" onclick={cek}>Coba lagi</button>
    {:else}
      <form class="card" class:shake onsubmit={kirim} in:fly={{ y: 12, duration: 250 }}>
        {#if mode === 'setup'}
          <p class="lead">Pertama kali ke sini? Bikin <b>PIN rahasia</b> dulu, biar surat & album cuma bisa dibuka kamu (dan {config.pengirim}).</p>
          <label>
            <span>PIN baru (4–8 angka)</span>
            <input class="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" value={pin} oninput={(e) => (pin = digits(e.currentTarget.value))} />
          </label>
          <label>
            <span>Ulangi PIN</span>
            <input class="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" value={pin2} oninput={(e) => (pin2 = digits(e.currentTarget.value))} />
          </label>
          <p class="tip">Jangan pakai tanggal lahir ya, itu gampang ditebak 😄</p>
        {:else if mode === 'login'}
          <label>
            <span>Masukkan PIN-mu</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input class="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" autofocus value={pin} oninput={(e) => (pin = digits(e.currentTarget.value))} />
          </label>
        {:else}
          <label>
            <span>Kata sandi {config.pengirim}</span>
            <input type="password" autocomplete="current-password" bind:value={password} />
          </label>
        {/if}

        {#if error}<p class="err" role="alert">{error}</p>{/if}

        <button class="btn pink" type="submit" disabled={busy}>
          {busy ? 'Sebentar…' : mode === 'setup' ? 'Simpan PIN & masuk' : 'Masuk'}
        </button>
      </form>

      <button
        class="link"
        onclick={() => {
          error = ''
          mode = mode === 'admin' ? 'loading' : 'admin'
          if (mode === 'loading') void cek()
        }}
      >
        {mode === 'admin' ? `Bukan ${config.pengirim}? Kembali` : `Aku ${config.pengirim}`}
      </button>
    {/if}
  </div>
{/if}

<style>
  .gate {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 8px 4px 20px;
  }
  .pad {
    width: 108px;
    height: 108px;
  }
  h2 {
    font-size: 44px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .why {
    max-width: 300px;
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
    line-height: 1.45;
  }
  .wait {
    margin-top: 20px;
    font-size: 26px;
    color: var(--muted-2);
  }
  .card {
    margin-top: 10px;
    width: min(100%, 340px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 20px 16px 22px 17px;
    box-shadow: 4px 4px 0 var(--ink);
    text-align: left;
  }
  .lead {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 800;
    color: var(--muted);
  }
  input {
    height: 52px;
    padding: 0 14px;
    border: 2.5px solid var(--ink);
    border-radius: 14px;
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: #fffdf8;
    width: 100%;
  }
  input:focus {
    outline: 3px solid var(--pink-soft);
    outline-offset: 0;
  }
  .pin {
    text-align: center;
    font-size: 26px;
    letter-spacing: 10px;
  }
  .tip {
    font-size: 12px;
    color: var(--muted-2);
    font-weight: 700;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .card .btn {
    width: 100%;
  }
  .link {
    margin-top: 6px;
    min-height: 44px;
    border: none;
    background: none;
    color: var(--muted);
    font-weight: 800;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
  .shake {
    animation: shake 0.4s;
  }
  @keyframes shake {
    20%,
    60% {
      translate: -6px 0;
    }
    40%,
    80% {
      translate: 6px 0;
    }
  }
</style>
