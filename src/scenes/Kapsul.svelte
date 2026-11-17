<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly, scale } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, waktu } from '../lib/ruang.svelte'
  import { sfx } from '../lib/audio'
  import { burst } from '../lib/fx'
  import { game } from '../lib/state.svelte'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import RuangGate from '../components/RuangGate.svelte'
  import Icon from '../components/Icon.svelte'

  type Isi = { teks: string; diubah: number }
  type Data = { bukaPada: number; sekarang: number; terbuka: boolean; punyaku: Isi | null; punyanya: Isi | { ada: boolean } | null }

  const MAX = 6000
  let data = $state<Data | null>(null)
  let skew = 0 // selisih jam server − jam HP, supaya hitung mundur tidak bisa "dicurangi" jam HP
  let now = $state(Date.now())
  let draft = $state('')
  let saved = $state('')
  let saving = $state(false)
  let error = $state('')
  let envOpen = $state(false)

  const me = $derived(sesi.role)
  const lawan = $derived(sesi.lawan)
  const umurKapsul = 22
  const sisa = $derived(data ? Math.max(0, data.bukaPada - (now + skew)) : 0)
  const parts = $derived({
    hari: Math.floor(sisa / 86_400_000),
    jam: Math.floor((sisa / 3_600_000) % 24),
    menit: Math.floor((sisa / 60_000) % 60),
    detik: Math.floor((sisa / 1000) % 60),
  })
  const tanggalBuka = $derived(
    data ? new Date(data.bukaPada).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '',
  )
  const surat = $derived(data?.terbuka && data.punyanya && 'teks' in data.punyanya ? data.punyanya : null)
  const lawanAda = $derived(!!data?.punyanya && ('teks' in data.punyanya ? !!data.punyanya.teks : data.punyanya.ada))
  const dirty = $derived(draft.trim() !== saved.trim())

  async function load() {
    try {
      const r = await api<Data>('kapsul')
      skew = r.sekarang - Date.now()
      data = r
      saved = draft = r.punyaku?.teks ?? ''
      error = ''
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) error = e.message
    }
  }
  $effect(() => {
    if (me && !data) void load()
  })

  onMount(() => {
    const t = setInterval(() => {
      now = Date.now()
      // Tepat saat waktunya tiba, ambil ulang supaya surat dari server ikut terbuka.
      if (data && !data.terbuka && sisa <= 0) void load()
    }, 1000)
    return () => clearInterval(t)
  })

  async function simpan() {
    if (saving || !dirty) return
    if ([...draft].length > MAX) return game.say(`Maksimal ${MAX} karakter ya.`)
    saving = true
    try {
      const r = await api<{ punyaku: Isi | null }>('kapsul', { method: 'PUT', body: { teks: draft } })
      saved = r.punyaku?.teks ?? ''
      if (data) data.punyaku = r.punyaku
      sfx.tap()
      game.say(saved ? 'Tersimpan di kapsul. Dibuka nanti ya!' : 'Tulisanmu dikosongkan.')
    } catch (e) {
      game.say(e instanceof ApiError ? e.message : 'Gagal menyimpan')
    } finally {
      saving = false
    }
  }

  function bukaAmplop() {
    envOpen = true
    sfx.tada()
    burst({ big: true, y: 0.4 })
  }
  const pad = (n: number) => String(n).padStart(2, '0')
</script>

<section class="scene arcade kapsul">
  <ArcadeHeader title="Kapsul Waktu" />

  <RuangGate alasan="Surat yang baru bisa dibuka di ulang tahun ke-{umurKapsul}. Kuncinya di server, jadi nggak bisa diintip duluan.">
    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if !data}
      <p class="hand wait">membuka kapsul…</p>
    {:else if !data.terbuka}
      <div class="jar" in:scale={{ start: 0.9, duration: 300 }}>
        <svg aria-hidden="true" viewBox="0 0 120 140" fill="none" stroke="#23408E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="30" y="8" width="60" height="16" rx="5" fill="#C3B1F0" />
          <path d="M34 24 C18 34 16 52 16 70 V118 a14 14 0 0 0 14 14 H90 a14 14 0 0 0 14-14 V70 C104 52 102 34 86 24 Z" fill="#E8F4FF" />
          <path d="M34 70 l26 -14 l26 14 v34 H34 Z" fill="#FFFFFF" />
          <path d="M34 70 l26 18 l26 -18" fill="#FBD3DE" />
          <circle cx="60" cy="88" r="7" fill="#E0557A" stroke-width="2" />
          <path d="M26 46 h8 M86 50 h8 M24 100 l-6 2" stroke="#9CCBF0" />
          <path d="M98 30 l4 -6 M104 38 l6 -2" stroke="#F6D58E" stroke-width="3.4" />
        </svg>
      </div>
      <p class="hand opens">dibuka {tanggalBuka}</p>
      <div class="count" aria-label="Sisa {parts.hari} hari {parts.jam} jam {parts.menit} menit">
        <div><b>{parts.hari}</b><span>hari</span></div>
        <div><b>{pad(parts.jam)}</b><span>jam</span></div>
        <div><b>{pad(parts.menit)}</b><span>menit</span></div>
        <div><b>{pad(parts.detik)}</b><span>detik</span></div>
      </div>

      <p class="status" class:ada={lawanAda}>
        <Icon name={lawanAda ? 'lock' : 'mail'} size={16} />
        {lawanAda ? `${lawan} sudah menitipkan surat buat kamu. Tersegel sampai hari itu.` : `${lawan} belum nulis apa-apa. Senggol dong 😄`}
      </p>

      <div class="letter paper">
        <label for="kapsul-in" class="hand">{me === 'dilla' ? `Surat buat dirimu (& ${lawan}) di umur ${umurKapsul}` : `Surat buat ${lawan} di umur ${umurKapsul}`}</label>
        <textarea
          id="kapsul-in"
          bind:value={draft}
          maxlength={MAX + 50}
          placeholder={me === 'dilla'
            ? `Tulis harapanmu buat setahun ke depan, atau pesan buat ${lawan}. Kalian berdua baca bareng nanti.`
            : `Tulis sesuatu buat ${lawan} di umur 22: harapan, kenangan tahun ini, apa aja.`}
        ></textarea>
        <div class="row">
          <span class="meta">
            {#if data.punyaku && !dirty}tersimpan {waktu(data.punyaku.diubah)}{:else if dirty}belum disimpan{/if}
            {#if [...draft].length > MAX - 300} · {[...draft].length}/{MAX}{/if}
          </span>
          <button class="btn pink" onclick={simpan} disabled={saving || !dirty}>{saving ? 'Menyimpan…' : 'Simpan ke kapsul'}</button>
        </div>
      </div>
      <p class="tip">Masih bisa diubah sampai kapsulnya terbuka. {lawan} nggak bisa baca sebelum waktunya, kamu juga nggak bisa baca punyanya.</p>
    {:else}
      <!-- Sudah terbuka -->
      {#if !envOpen}
        <div class="reveal" in:fade>
          <p class="hand big">Kapsulnya sudah terbuka!</p>
          {#if surat?.teks}
            <button class="env" onclick={bukaAmplop} aria-label="Buka surat dari {lawan}">
              <svg aria-hidden="true" viewBox="0 0 240 180" fill="none" stroke="#23408E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 40 L218 36 L222 160 L18 164 Z" fill="#FFFFFF" /><path d="M22 40 L120 110 L218 36" fill="#FBD3DE" /><circle cx="120" cy="110" r="26" fill="#E0557A" stroke-width="5" /></svg>
              <span class="hand">dari {lawan} · ketuk untuk buka</span>
            </button>
          {:else}
            <p class="status">{lawan} ternyata nggak sempat nulis. Tagih langsung ya 😤</p>
            <button class="btn" onclick={() => (envOpen = true)}>Lihat tulisanku</button>
          {/if}
        </div>
      {:else}
        {#if surat?.teks}
          <article class="letter paper read" in:fly={{ y: 30, duration: 450 }}>
            <p class="hand from">dari {lawan}, ditulis {waktu(surat.diubah)}</p>
            <p class="body">{surat.teks}</p>
          </article>
        {/if}
        {#if data.punyaku?.teks}
          <article class="letter paper read mine" in:fly={{ y: 30, duration: 450, delay: 250 }}>
            <p class="hand from">tulisanmu sendiri, {waktu(data.punyaku.diubah)}</p>
            <p class="body">{data.punyaku.teks}</p>
          </article>
        {/if}
        <button class="btn" onclick={() => game.go('kotak')}><Icon name="mail" /> Balas di Kotak Surat</button>
      {/if}
    {/if}
  </RuangGate>
</section>

<style>
  .scene.kapsul {
    padding-left: 18px;
    padding-right: 18px;
    align-items: center;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .wait {
    margin-top: 40px;
    font-size: 26px;
    color: var(--muted-2);
  }
  .jar svg {
    width: 110px;
    height: 128px;
  }
  .opens {
    font-size: 26px;
    color: var(--pink-dark);
    line-height: 1;
    margin-top: 2px;
  }
  .count {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: min(100%, 340px);
    flex-shrink: 0;
  }
  .count div {
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 14px 11px 15px 12px;
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 2px 6px;
  }
  .count b {
    font-size: 26px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .count span {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
  }
  .status {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    color: var(--muted);
    text-align: left;
    max-width: 340px;
  }
  .status.ada {
    color: var(--ink);
  }
  .letter {
    margin-top: 14px;
    width: 100%;
    flex-shrink: 0;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    box-shadow: 4px 4px 0 var(--pink);
    padding: 14px 14px 12px 42px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .letter label {
    font-size: 22px;
    line-height: 1.1;
    color: var(--ink);
  }
  textarea {
    width: 100%;
    min-height: 200px;
    resize: vertical;
    border: none;
    background: transparent;
    font-family: var(--hand);
    font-weight: 500;
    font-size: 22px;
    line-height: 32px;
    color: var(--ink);
    padding: 0;
  }
  textarea:focus {
    outline: none;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .row .btn {
    min-height: 46px;
    padding: 0 16px;
    font-size: 15px;
  }
  .meta {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .tip {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 700;
    color: var(--muted-2);
    text-align: center;
  }
  .reveal {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .big {
    font-size: 38px;
    color: var(--pink-dark);
    line-height: 1;
  }
  .env {
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    animation: wiggle 2.4s ease-in-out infinite;
  }
  .env svg {
    width: 200px;
  }
  .env span {
    font-size: 22px;
    color: var(--ink);
  }
  @keyframes wiggle {
    0%,
    80%,
    100% {
      rotate: 0deg;
    }
    85% {
      rotate: -4deg;
    }
    90% {
      rotate: 4deg;
    }
    95% {
      rotate: -2deg;
    }
  }
  .read .from {
    font-size: 20px;
    color: var(--pink-dark);
  }
  .read .body {
    font-family: var(--hand);
    font-size: 23px;
    line-height: 32px;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .read.mine {
    box-shadow: 4px 4px 0 var(--ink);
  }
  .scene.kapsul > :global(.btn) {
    margin-top: 16px;
  }
  @media (prefers-reduced-motion: reduce) {
    .env {
      animation: none;
    }
  }
</style>
