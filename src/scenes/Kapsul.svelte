<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly, scale } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, waktu, type Role } from '../lib/ruang.svelte'
  import { sfx } from '../lib/audio'
  import { burst } from '../lib/fx'
  import { game } from '../lib/state.svelte'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import RuangGate from '../components/RuangGate.svelte'
  import Icon from '../components/Icon.svelte'

  type Kapsul = { id: string; from: Role; label: string; bukaPada: number; dibuat: number; terbuka: boolean; dibaca: Role[]; teks?: string; diubah?: number }
  type Data = { sekarang: number; items: Kapsul[]; ultahBerikut: number; umurBerikut: number }

  const MAX = 6000
  const HARI = 86_400_000

  let data = $state<Data | null>(null)
  let skew = 0 // jam server − jam HP: hitung mundur tidak bisa "dicurangi" dengan mengubah jam HP
  let now = $state(Date.now())
  let error = $state('')

  // form tulis / ubah
  let form = $state<{ id: string | null; label: string; teks: string; buka: string } | null>(null)
  let saving = $state(false)
  // pembaca surat
  let baca = $state<Kapsul | null>(null)
  let amplop = $state(false)

  const me = $derived(sesi.role)
  const lawan = $derived(sesi.lawan)
  const t = $derived(now + skew)
  const items = $derived((data?.items ?? []).map((k) => ({ ...k, terbuka: t >= k.bukaPada })))
  const untukku = $derived(items.filter((k) => k.from !== me))
  const dariku = $derived(items.filter((k) => k.from === me))
  const berikut = $derived(untukku.find((k) => !k.terbuka))
  const baruTerbuka = $derived(untukku.filter((k) => k.terbuka && me && !k.dibaca.includes(me)).length)

  async function load() {
    try {
      const r = await api<Data>('kapsul')
      skew = r.sekarang - Date.now()
      data = r
      error = ''
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) error = e.message
    }
  }
  $effect(() => {
    if (me && !data) void load()
  })

  onMount(() => {
    const iv = setInterval(() => {
      const before = items.some((k) => !k.terbuka && k.from !== me && k.bukaPada <= Date.now() + skew)
      now = Date.now()
      // Tepat saat ada kapsul untukku yang terbuka, ambil ulang supaya isinya ikut datang dari server.
      if (before) void load()
    }, 1000)
    return () => clearInterval(iv)
  })

  // ---------- format waktu ----------
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  function sisa(ms: number) {
    const d = Math.max(0, ms - t)
    if (d >= HARI) return `${Math.ceil(d / HARI)} hari lagi`
    const p = (n: number) => String(Math.floor(n)).padStart(2, '0')
    return `${p(d / 3_600_000)}:${p((d / 60_000) % 60)}:${p((d / 1000) % 60)}`
  }
  const parts = $derived.by(() => {
    const d = berikut ? Math.max(0, berikut.bukaPada - t) : 0
    return { hari: Math.floor(d / HARI), jam: Math.floor((d / 3_600_000) % 24), menit: Math.floor((d / 60_000) % 60), detik: Math.floor((d / 1000) % 60) }
  })
  const pad = (n: number) => String(n).padStart(2, '0')

  // <input type="datetime-local"> bekerja di zona waktu HP (WIB untuk kalian berdua).
  function toInput(ms: number) {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const fromInput = (s: string) => (s ? new Date(s).getTime() : NaN)

  // ---------- pilihan cepat waktu buka ----------
  function plus(bulan: number, hari = 0) {
    const d = new Date(t)
    d.setMonth(d.getMonth() + bulan)
    d.setDate(d.getDate() + hari)
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d.getTime()
  }
  const cepat = $derived(
    data
      ? [
          { label: '1 minggu', ms: plus(0, 7) },
          { label: '1 bulan', ms: plus(1) },
          { label: '6 bulan', ms: plus(6) },
          { label: '1 tahun', ms: plus(12) },
          { label: `Ultah ${config.nama} ke-${data.umurBerikut}`, ms: data.ultahBerikut },
        ]
      : [],
  )
  const bukaMs = $derived(form ? fromInput(form.buka) : NaN)
  const bukaValid = $derived(Number.isFinite(bukaMs) && bukaMs > t + 60_000)

  function tulis() {
    form = { id: null, label: '', teks: '', buka: data ? toInput(data.ultahBerikut) : '' }
  }
  function ubah(k: Kapsul) {
    form = { id: k.id, label: k.label, teks: k.teks ?? '', buka: toInput(k.bukaPada) }
  }

  async function simpan(e: Event) {
    e.preventDefault()
    if (!form || saving) return
    if (!form.teks.trim()) return game.say('Suratnya masih kosong.')
    if (!bukaValid) return game.say('Waktu bukanya harus di masa depan ya.')
    if ([...form.teks].length > MAX) return game.say(`Maksimal ${MAX} karakter ya.`)
    saving = true
    try {
      const body = { id: form.id ?? undefined, label: form.label, teks: form.teks, bukaPada: bukaMs }
      const r = await api<{ item: Kapsul }>('kapsul', { method: form.id ? 'PUT' : 'POST', body })
      const ada = data!.items.some((k) => k.id === r.item.id)
      data!.items = ada ? data!.items.map((k) => (k.id === r.item.id ? r.item : k)) : [...data!.items, r.item].sort((a, b) => a.bukaPada - b.bukaPada)
      sfx.tap()
      game.say(form.id ? 'Kapsulnya diperbarui.' : `Kapsul tersegel! ${lawan} baru bisa baca ${fmt(r.item.bukaPada)}.`, 3600)
      form = null
    } catch (err) {
      game.say(err instanceof ApiError ? err.message : 'Gagal menyimpan')
    } finally {
      saving = false
    }
  }

  async function hapus() {
    if (!form?.id || !confirm('Hapus kapsul ini? Isinya hilang dan tidak bisa dikembalikan.')) return
    try {
      await api(`kapsul?id=${form.id}`, { method: 'DELETE' })
      data!.items = data!.items.filter((k) => k.id !== form!.id)
      form = null
      game.say('Kapsulnya dihapus.')
    } catch (err) {
      game.say(err instanceof ApiError ? err.message : 'Gagal menghapus')
    }
  }

  function pilih(k: Kapsul) {
    if (k.from === me && !k.terbuka) return ubah(k)
    if (!k.terbuka) {
      sfx.wrong()
      return game.say(`Sabar… baru kebuka ${fmt(k.bukaPada)}.`)
    }
    if (!k.teks) {
      // Baru saja terbuka tapi isinya belum diambil dari server.
      void load()
      return game.say('Sebentar, kapsulnya lagi dibuka…')
    }
    baca = k
    amplop = !!me && k.from !== me && !k.dibaca.includes(me)
  }

  async function bukaAmplop() {
    if (!baca || !me) return
    amplop = false
    sfx.tada()
    burst({ big: true, y: 0.4 })
    const id = baca.id
    data!.items = data!.items.map((k) => (k.id === id ? { ...k, dibaca: [...k.dibaca, me!] } : k))
    await api('kapsul', { method: 'PUT', body: { id, baca: true } }).catch(() => {})
  }

  const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)
</script>

<section class="scene arcade kapsul">
  <ArcadeHeader title="Kapsul Waktu" />

  <RuangGate alasan="Titip surat buat dibuka di waktu yang kamu pilih. Kuncinya di server, jadi nggak bisa diintip duluan.">
    {#if error}<p class="err" role="alert">{error} <button class="link" onclick={load}>Coba lagi</button></p>{/if}

    {#if !data}
      <p class="hand wait">membuka kapsul…</p>
    {:else}
      <div class="hero" in:scale={{ start: 0.92, duration: 300 }}>
        <svg class="jar" aria-hidden="true" viewBox="0 0 120 140" fill="none" stroke="#23408E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="30" y="8" width="60" height="16" rx="5" fill="#C3B1F0" />
          <path d="M34 24 C18 34 16 52 16 70 V118 a14 14 0 0 0 14 14 H90 a14 14 0 0 0 14-14 V70 C104 52 102 34 86 24 Z" fill="#E8F4FF" />
          <path d="M34 70 l26 -14 l26 14 v34 H34 Z" fill="#FFFFFF" />
          <path d="M34 70 l26 18 l26 -18" fill="#FBD3DE" />
          <circle cx="60" cy="88" r="7" fill="#E0557A" stroke-width="2" />
          <path d="M26 46 h8 M86 50 h8 M24 100 l-6 2" stroke="#9CCBF0" />
          <path d="M98 30 l4 -6 M104 38 l6 -2" stroke="#F6D58E" stroke-width="3.4" />
        </svg>
        {#if baruTerbuka > 0}
          <p class="hand big">{baruTerbuka} kapsul dari {lawan} sudah terbuka!</p>
        {:else if berikut}
          <p class="hand opens">kapsul dari {lawan} terbuka dalam</p>
          <div class="count" aria-label="Sisa {parts.hari} hari {parts.jam} jam {parts.menit} menit">
            <div><b>{parts.hari}</b><span>hari</span></div>
            <div><b>{pad(parts.jam)}</b><span>jam</span></div>
            <div><b>{pad(parts.menit)}</b><span>menit</span></div>
            <div><b>{pad(parts.detik)}</b><span>detik</span></div>
          </div>
        {:else}
          <p class="lead">Tulis surat buat {lawan} yang baru bisa dibuka nanti: minggu depan, pas wisuda, atau ulang tahun berikutnya.</p>
        {/if}
      </div>

      <button class="btn pink new" onclick={tulis}><Icon name="plus" /> Tulis kapsul baru</button>

      <h2 class="hand sec">Untukmu</h2>
      {#if untukku.length === 0}
        <p class="empty">{lawan} belum menitipkan kapsul. Senggol dong 😄</p>
      {:else}
        <ul class="list">
          {#each untukku as k (k.id)}
            {@const baru = k.terbuka && me && !k.dibaca.includes(me)}
            <li>
              <button class="item" class:sealed={!k.terbuka} class:baru onclick={() => pilih(k)}>
                <span class="ic"><Icon name={k.terbuka ? 'mail' : 'lock'} size={20} /></span>
                <span class="txt">
                  <b>{k.label || `Kapsul dari ${nama(k.from)}`}</b>
                  <span>{k.terbuka ? (baru ? 'Sudah bisa dibuka!' : `dibuka ${waktu(k.bukaPada)}`) : `terbuka ${fmt(k.bukaPada)}`}</span>
                </span>
                <em class="tag">{k.terbuka ? (baru ? 'BUKA' : 'baca') : sisa(k.bukaPada)}</em>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <h2 class="hand sec">Darimu</h2>
      {#if dariku.length === 0}
        <p class="empty">Belum ada. Tulis yang pertama?</p>
      {:else}
        <ul class="list">
          {#each dariku as k (k.id)}
            <li>
              <button class="item mine" class:sealed={!k.terbuka} onclick={() => pilih(k)}>
                <span class="ic"><Icon name={k.terbuka ? 'mail' : 'lock'} size={20} /></span>
                <span class="txt">
                  <b>{k.label || 'Tanpa petunjuk'}</b>
                  <span>
                    {#if k.terbuka}
                      {k.dibaca.includes(k.from === 'dilla' ? 'parid' : 'dilla') ? `sudah dibaca ${lawan}` : `terbuka, belum dibaca ${lawan}`}
                    {:else}
                      terbuka {fmt(k.bukaPada)} · ketuk untuk ubah
                    {/if}
                  </span>
                </span>
                <em class="tag">{k.terbuka ? 'baca' : sisa(k.bukaPada)}</em>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="tip">Isi kapsul baru dikirim server ke penerima saat waktunya tiba. Sebelum itu, penulisnya masih bisa mengubah atau menghapus.</p>
    {/if}
  </RuangGate>
</section>

<!-- Form tulis / ubah kapsul -->
{#if form}
  <div class="back overlay-fixed" transition:fade={{ duration: 150 }}></div>
  <div class="sheet overlay-fixed paper" role="dialog" aria-modal="true" aria-labelledby="form-t" transition:fly={{ y: 300, duration: 280 }}>
  <form class="form" onsubmit={simpan}>
    <div class="head">
      <h3 id="form-t" class="hand">{form.id ? 'Ubah kapsul' : `Kapsul buat ${lawan}`}</h3>
      <button type="button" class="icon-btn" aria-label="Tutup" onclick={() => (form = null)}><Icon name="close" /></button>
    </div>

    <label class="fld">
      <span>Petunjuk di amplop <i>(opsional · terlihat sebelum dibuka)</i></span>
      <input type="text" maxlength="60" placeholder="mis. buka pas kamu wisuda" bind:value={form.label} />
    </label>

    <label class="fld grow">
      <span>Isi surat <i>(rahasia sampai waktunya)</i></span>
      <textarea maxlength={MAX + 50} placeholder="Tulis apa aja: harapan, kenangan, ramalan ngawur…" bind:value={form.teks}></textarea>
    </label>

    <fieldset class="fld">
      <legend>Dibuka kapan?</legend>
      <div class="chips">
        {#each cepat as c (c.label)}
          <button type="button" class="chip" class:on={Math.abs(bukaMs - c.ms) < 60_000} onclick={() => (form!.buka = toInput(c.ms))}>{c.label}</button>
        {/each}
      </div>
      <input type="datetime-local" min={toInput(t + 120_000)} bind:value={form.buka} aria-label="Tanggal & jam dibuka" />
      <p class="when" class:bad={!bukaValid}>
        {bukaValid ? `Terbuka ${fmt(bukaMs)} · ${sisa(bukaMs)}` : 'Pilih waktu di masa depan'}
      </p>
    </fieldset>

    <div class="acts">
      {#if form.id}<button type="button" class="icon-btn del" aria-label="Hapus kapsul" onclick={hapus}><Icon name="trash" /></button>{/if}
      <button class="btn pink grow" type="submit" disabled={saving || !bukaValid || !form.teks.trim()}>
        {saving ? 'Menyegel…' : form.id ? 'Simpan perubahan' : 'Segel kapsul'}
      </button>
    </div>
  </form>
  </div>
{/if}

<!-- Pembaca surat -->
{#if baca}
  <div class="back overlay-fixed" role="presentation" onclick={() => (baca = null)} transition:fade={{ duration: 150 }}></div>
  <div class="reader overlay-fixed" role="dialog" aria-modal="true" aria-label="Isi kapsul" transition:fade={{ duration: 200 }}>
    {#if amplop}
      <button class="env" onclick={bukaAmplop} aria-label="Buka amplop dari {nama(baca.from)}" in:scale={{ start: 0.8, duration: 350 }}>
        <svg aria-hidden="true" viewBox="0 0 240 180" fill="none" stroke="#23408E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 40 L218 36 L222 160 L18 164 Z" fill="#FFFFFF" /><path d="M22 40 L120 110 L218 36" fill="#FBD3DE" /><circle cx="120" cy="110" r="26" fill="#E0557A" stroke-width="5" /></svg>
        <span class="hand">{baca.label || `dari ${nama(baca.from)}`}</span>
        <span class="small">ketuk untuk membuka</span>
      </button>
    {:else}
      <article class="letter paper" in:fly={{ y: 30, duration: 400 }}>
        <div class="head">
          <p class="hand from">dari {nama(baca.from)}{baca.label ? ` · ${baca.label}` : ''}</p>
          <button class="icon-btn" aria-label="Tutup" onclick={() => (baca = null)}><Icon name="close" /></button>
        </div>
        <p class="body">{baca.teks}</p>
        <p class="meta">ditulis {waktu(baca.dibuat)} · terbuka {waktu(baca.bukaPada)}</p>
        {#if baca.from !== me}
          <button
            class="btn"
            onclick={() => {
              baca = null
              game.go('kotak')
            }}><Icon name="mail" /> Balas di Kotak Surat</button
          >
        {/if}
      </article>
    {/if}
  </div>
{/if}

<style>
  .scene.kapsul {
    padding-left: 18px;
    padding-right: 18px;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
  }
  .link {
    border: none;
    background: none;
    color: inherit;
    font-weight: 800;
    text-decoration: underline;
    cursor: pointer;
  }
  .wait {
    margin-top: 40px;
    text-align: center;
    font-size: 26px;
    color: var(--muted-2);
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    flex-shrink: 0;
  }
  .jar {
    width: 92px;
    height: 108px;
  }
  .big {
    font-size: 30px;
    line-height: 1.05;
    color: var(--pink-dark);
    margin-top: 4px;
  }
  .opens {
    font-size: 24px;
    color: var(--pink-dark);
    line-height: 1;
    margin-top: 4px;
  }
  .lead {
    max-width: 320px;
    margin-top: 6px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.5;
    color: var(--muted);
  }
  .count {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: min(100%, 340px);
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
  .new {
    margin-top: 18px;
    width: 100%;
    flex-shrink: 0;
  }
  .sec {
    margin-top: 20px;
    font-size: 28px;
    line-height: 1;
    color: var(--ink);
  }
  .empty {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted-2);
  }
  .list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
    flex-shrink: 0;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 16px 12px 18px 13px;
    box-shadow: 3px 3px 0 var(--ink);
    text-align: left;
    color: var(--ink);
    cursor: pointer;
    position: relative;
  }
  .item:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .item.sealed {
    background: #ece4ff;
  }
  .item.mine.sealed {
    background: #e3f0ff;
  }
  .item.baru {
    background: #ffe3ea;
    animation: nudge 2.4s ease-in-out infinite;
  }
  @keyframes nudge {
    0%,
    80%,
    100% {
      rotate: 0deg;
    }
    86% {
      rotate: -1.5deg;
    }
    93% {
      rotate: 1.5deg;
    }
  }
  .ic {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .txt b {
    font-size: 15px;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .txt span {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .tag {
    flex-shrink: 0;
    padding: 4px 9px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-size: 11.5px;
    font-weight: 900;
    font-style: normal;
    font-variant-numeric: tabular-nums;
  }
  .baru .tag {
    background: var(--pink-dark);
    color: #fff;
  }
  .tip {
    margin: 16px 0 8px;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 700;
    color: var(--muted-2);
    text-align: center;
  }

  .back {
    z-index: 70;
    background: rgba(22, 40, 90, 0.45);
  }
  .sheet {
    z-index: 71;
    top: auto;
    max-height: 92%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 16px 18px calc(18px + var(--safe-bottom)) 44px;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .sheet h3 {
    font-size: 32px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .fld > span,
  legend {
    font-size: 13px;
    font-weight: 800;
    color: var(--muted);
    padding: 0;
  }
  .fld i {
    font-style: normal;
    font-weight: 700;
    color: var(--muted-2);
  }
  .fld input {
    height: 48px;
    padding: 0 12px;
    border: 2.5px solid var(--ink);
    border-radius: 14px;
    background: #fff;
    font: inherit;
    font-size: 16px;
    color: var(--text);
    width: 100%;
  }
  textarea {
    min-height: 170px;
    resize: vertical;
    padding: 10px 12px;
    border: 2.5px solid var(--ink);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.85);
    font-family: var(--hand);
    font-weight: 500;
    font-size: 22px;
    line-height: 30px;
    color: var(--ink);
  }
  .fld input:focus,
  textarea:focus {
    outline: 3px solid var(--pink-soft);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chips .chip {
    cursor: pointer;
  }
  .chips .chip.on {
    background: var(--ink);
    color: #fff;
  }
  .when {
    font-size: 13px;
    font-weight: 800;
    color: var(--ink);
  }
  .when.bad {
    color: var(--pink-dark);
  }
  .acts {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .del {
    width: 54px;
    height: 54px;
    color: var(--pink-dark);
  }

  .reader {
    z-index: 72;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(20px + var(--safe-top)) 16px calc(20px + var(--safe-bottom));
  }
  .reader > * {
    pointer-events: auto;
  }
  .env {
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #fff;
    animation: nudge 2.4s ease-in-out infinite;
  }
  .env svg {
    width: 220px;
  }
  .env .hand {
    font-size: 28px;
    color: #fff;
    text-align: center;
  }
  .env .small {
    font-size: 13px;
    font-weight: 800;
    opacity: 0.85;
  }
  .letter {
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    box-shadow: 5px 5px 0 var(--pink);
    padding: 14px 14px 16px 44px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .from {
    font-size: 22px;
    line-height: 1.1;
    color: var(--pink-dark);
  }
  .body {
    font-family: var(--hand);
    font-size: 23px;
    line-height: 32px;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--muted-2);
  }
  @media (prefers-reduced-motion: reduce) {
    .item.baru,
    .env {
      animation: none;
    }
  }
</style>
