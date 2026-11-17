<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, tandaiDibaca, tutupNotif, type Role } from '../lib/ruang.svelte'
  import { sfx } from '../lib/audio'
  import { game } from '../lib/state.svelte'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import RuangGate from '../components/RuangGate.svelte'
  import NotifToggle from '../components/NotifToggle.svelte'
  import Icon from '../components/Icon.svelte'
  import { kompres } from '../lib/foto'

  type Foto = { id?: string; w: number; h: number; src: string }
  type Msg = { id: number; from: Role; text: string; at: number; foto?: Foto; status?: 'sending' | 'failed'; _blob?: Blob }
  type Lampiran = { blob: Blob; url: string; w: number; h: number }

  const POLL_MS = 7000
  const MAX = 1000
  const MAX_CAPTION = 300 // keterangan foto

  let msgs = $state<Msg[]>([])
  let read = $state<Record<Role, number>>({ dilla: 0, parid: 0 })
  let loaded = $state(false)
  let error = $state('')
  let text = $state('')
  let list = $state<HTMLDivElement>()
  let ta = $state<HTMLTextAreaElement>()
  let tmp = -1
  let lampiran = $state<Lampiran | null>(null)
  let menyiapkan = $state(false)
  let picker = $state<HTMLInputElement>()
  let lihat = $state<Foto | null>(null)
  const batas = $derived(lampiran ? MAX_CAPTION : MAX)

  const me = $derived(sesi.role)
  const lastId = $derived(msgs.reduce((m, x) => (x.id > m ? x.id : m), 0))
  const lastMine = $derived([...msgs].reverse().find((m) => m.from === me && m.id > 0))
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  const SARAN: Record<Role, string[]> = {
    dilla: ['Makasih websitenya! 🥹', 'Traktirannya kapan nih?', 'Hari ini aku…'],
    parid: ['Gimana harimu?', 'Udah makan belum?', 'Rekor lari cupcake-mu berapa?'],
  }

  function nearBottom() {
    return !list || list.scrollHeight - list.scrollTop - list.clientHeight < 120
  }
  async function toBottom(smooth = true) {
    await tick()
    list?.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  async function markRead() {
    if (!me || document.hidden || game.scene !== 'kotak') return
    if (lastId > read[me]) {
      read = { ...read, [me]: lastId }
      await tandaiDibaca(lastId)
    } else {
      sesi.unread = 0
      void tutupNotif('pesan')
    }
  }

  let polling = false
  async function poll(first = false) {
    if (polling || !me) return
    polling = true
    try {
      // Ambil sedikit ke belakang (lastId - 5) supaya surat yang masuk hampir bersamaan tidak terlewat.
      const r = await api<{ messages: Msg[]; read: Record<Role, number> }>(`pesan?after=${Math.max(0, lastId - 5)}`)
      const known = new Set(msgs.map((m) => m.id))
      const baru = r.messages.filter((m) => !known.has(m.id))
      read = r.read
      error = ''
      if (baru.length) {
        const stick = first || nearBottom()
        msgs = [...msgs, ...baru].sort((a, b) => (a.id < 0 ? Infinity : a.id) - (b.id < 0 ? Infinity : b.id))
        if (!first && baru.some((m) => m.from !== me)) sfx.pop()
        if (stick) await toBottom(!first)
      }
      loaded = true
      await markRead()
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) error = e.message
    } finally {
      polling = false
    }
  }

  onMount(() => {
    const t = setInterval(() => !document.hidden && poll(), POLL_MS)
    const vis = () => !document.hidden && poll()
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  })

  // Mulai memuat begitu sudah masuk (termasuk tepat setelah login di RuangGate).
  $effect(() => {
    if (me && !loaded) void poll(true)
  })

  async function pilihFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    menyiapkan = true
    try {
      const r = await kompres(file)
      if (lampiran) URL.revokeObjectURL(lampiran.url)
      lampiran = { ...r, url: URL.createObjectURL(r.blob) }
      ta?.focus()
    } catch {
      game.say('File itu tidak bisa dibaca sebagai foto.')
    } finally {
      menyiapkan = false
    }
  }

  function batalFoto() {
    if (lampiran) URL.revokeObjectURL(lampiran.url)
    lampiran = null
  }

  const urut = (a: Msg, b: Msg) => (a.id < 0 ? Infinity : a.id) - (b.id < 0 ? Infinity : b.id)

  async function kirimFoto(l: Lampiran, t: string, ulang?: Msg) {
    if (!me) return
    const draft: Msg = ulang ?? { id: tmp--, from: me, text: t, at: Date.now(), foto: { w: l.w, h: l.h, src: l.url }, status: 'sending', _blob: l.blob }
    if (ulang) msgs = msgs.map((m) => (m.id === ulang.id ? { ...m, status: 'sending' } : m))
    else msgs = [...msgs, draft]
    sfx.tap()
    await toBottom()
    try {
      const r = await api<{ message: Msg }>('pesan', {
        method: 'POST',
        raw: l.blob,
        headers: { 'content-type': 'image/jpeg', 'x-text': encodeURIComponent(t), 'x-w': String(l.w), 'x-h': String(l.h) },
      })
      msgs = msgs.map((m) => (m.id === draft.id ? r.message : m)).sort(urut)
      read = { ...read, [me]: Math.max(read[me], r.message.id) }
      setTimeout(() => URL.revokeObjectURL(l.url), 5000) // biarkan <img> server sempat dimuat
    } catch (e) {
      msgs = msgs.map((m) => (m.id === draft.id ? { ...m, status: 'failed' } : m))
      game.say(e instanceof ApiError ? e.message : 'Fotonya gagal terkirim.')
    }
  }

  async function send(isi = text) {
    const t = isi.trim()
    if (!me) return
    if (lampiran && isi === text) {
      if ([...t].length > MAX_CAPTION) return game.say(`Keterangan foto maksimal ${MAX_CAPTION} karakter ya.`)
      const l = lampiran
      lampiran = null
      text = ''
      await tick()
      resize()
      return kirimFoto(l, t)
    }
    if (!t) return
    if ([...t].length > MAX) return game.say(`Maksimal ${MAX} karakter ya.`)
    const draft: Msg = { id: tmp--, from: me, text: t, at: Date.now(), status: 'sending' }
    msgs = [...msgs, draft]
    if (isi === text) text = ''
    await tick() // tunggu textarea kosong di DOM, baru hitung ulang tingginya
    resize()
    sfx.tap()
    await toBottom()
    try {
      const r = await api<{ message: Msg }>('pesan', { body: { text: t } })
      msgs = msgs.map((m) => (m.id === draft.id ? r.message : m)).sort(urut)
      read = { ...read, [me]: Math.max(read[me], r.message.id) }
    } catch (e) {
      msgs = msgs.map((m) => (m.id === draft.id ? { ...m, status: 'failed' } : m))
      game.say(e instanceof ApiError ? e.message : 'Gagal terkirim.')
    }
  }

  function retry(m: Msg) {
    if (m.foto && m._blob) return void kirimFoto({ blob: m._blob, url: m.foto.src, w: m.foto.w, h: m.foto.h }, m.text, m)
    msgs = msgs.filter((x) => x.id !== m.id)
    void send(m.text)
  }

  function onKey(e: KeyboardEvent) {
    // Laptop: Enter = kirim, Shift+Enter = baris baru. HP: Enter = baris baru (tombol kirim terpisah).
    if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  function resize() {
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'
  }

  function hari(ms: number) {
    const d = new Date(ms)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Hari ini'
    const k = new Date(now)
    k.setDate(now.getDate() - 1)
    if (d.toDateString() === k.toDateString()) return 'Kemarin'
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
  }
  const jam = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)
</script>

<section class="scene arcade kotak">
  <ArcadeHeader title="Kotak Surat" />

  <RuangGate alasan="Kotak surat ini cuma buat kamu dan {config.pengirim}. Isinya tersimpan, bisa dibalas kapan aja.">
    <div class="wrap">
      <div class="bar">
        <span class="with">surat-suratan sama <b>{sesi.lawan}</b></span>
        <NotifToggle />
      </div>

      <div class="list paper" bind:this={list} aria-live="polite">
        {#if !loaded}
          <p class="hand empty">membuka kotak…</p>
        {:else if msgs.length === 0}
          <div class="empty">
            <svg aria-hidden="true" viewBox="0 0 240 180" fill="none" stroke="#23408E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 40 L218 36 L222 160 L18 164 Z" fill="#FFFFFF" /><path d="M22 40 L120 110 L218 36" fill="#FBD3DE" /><circle cx="120" cy="110" r="26" fill="#E0557A" stroke-width="5" /></svg>
            <p class="hand">Kotaknya masih kosong.</p>
            <p>Tulis surat pertama buat {sesi.lawan}?</p>
          </div>
        {:else}
          {#each msgs as m, i (m.id)}
            {#if i === 0 || hari(msgs[i - 1].at) !== hari(m.at)}
              <p class="day"><span>{hari(m.at)}</span></p>
            {/if}
            {@const mine = m.from === me}
            <div class="row" class:mine in:fly={{ y: 10, duration: 220 }}>
              <div class="bubble" class:mine class:failed={m.status === 'failed'}>
                {#if !mine && (i === 0 || msgs[i - 1].from !== m.from)}<span class="who hand">{nama(m.from)}</span>{/if}
                {#if m.foto}
                  <button class="photo" style="aspect-ratio:{m.foto.w && m.foto.h ? `${m.foto.w}/${m.foto.h}` : '4/3'}" onclick={() => (lihat = m.foto!)} aria-label="Lihat foto">
                    <img src={m.foto.src} alt={m.text || `Foto dari ${nama(m.from)}`} loading="lazy" decoding="async" />
                  </button>
                {/if}
                {#if m.text}<p>{m.text}</p>{/if}
                <span class="meta">
                  {m.status === 'sending' ? 'mengirim…' : m.status === 'failed' ? 'gagal' : jam(m.at)}
                  {#if mine && m.id === lastMine?.id && !m.status}
                    · {read[me === 'dilla' ? 'parid' : 'dilla'] >= m.id ? 'dibaca' : 'terkirim'}
                  {/if}
                </span>
              </div>
              {#if m.status === 'failed'}
                <button class="retry" onclick={() => retry(m)}>Kirim ulang</button>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      {#if error}<p class="err" role="alert">{error}</p>{/if}

      {#if loaded && msgs.length < 3 && !text && me}
        <div class="saran">
          {#each SARAN[me] as s (s)}
            <button class="chip" onclick={() => (s.endsWith('…') ? ((text = s.slice(0, -1) + ' '), ta?.focus()) : send(s))}>{s}</button>
          {/each}
        </div>
      {/if}

      {#if lampiran || menyiapkan}
        <div class="attach" transition:fade={{ duration: 150 }}>
          {#if lampiran}<img src={lampiran.url} alt="Foto yang akan dikirim" />{:else}<div class="thumb ph"></div>{/if}
          <span>{menyiapkan ? 'menyiapkan foto…' : 'Foto siap dikirim. Tulis keterangan kalau mau.'}</span>
          <button class="icon-btn" type="button" aria-label="Batal kirim foto" onclick={batalFoto} disabled={menyiapkan}><Icon name="close" size={18} /></button>
        </div>
      {/if}

      <form
        class="compose"
        onsubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <button class="pick" type="button" aria-label="Kirim foto" onclick={() => picker?.click()} disabled={menyiapkan}><Icon name="image" size={22} /></button>
        <input bind:this={picker} class="sr-only" type="file" accept="image/*" onchange={pilihFoto} tabindex="-1" aria-hidden="true" />
        <label class="sr-only" for="surat-in">Tulis surat</label>
        <textarea id="surat-in" bind:this={ta} bind:value={text} rows="1" maxlength={batas + 50} placeholder={lampiran ? 'Keterangan foto (opsional)…' : `Tulis surat buat ${sesi.lawan}…`} oninput={resize} onkeydown={onKey}></textarea>
        <button class="send" type="submit" aria-label="Kirim" disabled={(!text.trim() && !lampiran) || menyiapkan}><Icon name="send" size={22} /></button>
      </form>
      {#if [...text].length > batas - 100}<p class="count" class:over={[...text].length > batas}>{[...text].length}/{batas}</p>{/if}
    </div>
  </RuangGate>
</section>

{#if lihat}
  <div class="viewer overlay-fixed" role="dialog" aria-modal="true" aria-label="Foto" transition:fade={{ duration: 180 }}>
    <div class="vtop">
      <a class="icon-btn" href={lihat.src} download="foto-kotak-surat.jpg" aria-label="Simpan foto"><Icon name="download" /></a>
      <button class="icon-btn" aria-label="Tutup" onclick={() => (lihat = null)}><Icon name="close" /></button>
    </div>
    <button class="vimg" onclick={() => (lihat = null)} aria-label="Tutup foto"><img src={lihat.src} alt="" /></button>
  </div>
{/if}

<svelte:window onkeydown={(e) => e.key === 'Escape' && (lihat = null)} />

<style>
  .scene.kotak {
    padding-left: 16px;
    padding-right: 16px;
    overflow: hidden;
  }
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .with {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    box-shadow: 4px 4px 0 var(--ink);
    padding: 14px 12px 14px 42px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .empty {
    margin: auto;
    text-align: center;
    color: var(--muted);
    font-weight: 700;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .empty svg {
    width: 120px;
    margin-bottom: 6px;
  }
  .empty .hand,
  p.empty {
    font-size: 26px;
    color: var(--ink);
  }
  .day {
    text-align: center;
    margin: 8px 0 2px;
  }
  .day span {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    border: 1.5px solid var(--line);
    font-size: 11px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .row.mine {
    align-items: flex-end;
  }
  .bubble {
    max-width: 82%;
    padding: 8px 12px 6px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 16px 16px 16px 4px;
    box-shadow: 2px 2px 0 rgba(35, 64, 142, 0.25);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bubble.mine {
    background: var(--pink-soft);
    border-radius: 16px 16px 4px 16px;
  }
  .bubble.failed {
    border-style: dashed;
    opacity: 0.8;
  }
  .who {
    font-size: 18px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .bubble p {
    font-size: 15px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text);
  }
  .meta {
    align-self: flex-end;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .retry {
    margin-top: 2px;
    border: none;
    background: none;
    color: var(--pink-dark);
    font-weight: 800;
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
    min-height: 32px;
  }
  .err {
    font-size: 12px;
    font-weight: 800;
    color: var(--pink-dark);
    text-align: center;
  }
  .saran {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    flex-shrink: 0;
    padding-bottom: 2px;
  }
  .saran .chip {
    cursor: pointer;
    background: #fff4cc;
  }
  .compose {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
  }
  textarea {
    flex: 1;
    min-height: 50px;
    max-height: 132px;
    resize: none;
    padding: 12px 14px;
    border: 2.5px solid var(--ink);
    border-radius: 16px 12px 18px 13px;
    background: #fff;
    font: inherit;
    font-size: 16px; /* ≥16px supaya iPhone tidak auto-zoom */
    line-height: 1.4;
    color: var(--text);
  }
  textarea:focus {
    outline: 3px solid var(--pink-soft);
  }
  .photo {
    display: block;
    width: min(220px, 58vw);
    max-height: 300px;
    margin: 2px 0;
    padding: 0;
    border: 2px solid var(--ink);
    border-radius: 10px;
    overflow: hidden;
    background: #eef3fb;
    cursor: zoom-in;
  }
  .photo img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .attach {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 8px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
    flex-shrink: 0;
  }
  .attach img,
  .thumb {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 8px;
    border: 1.5px solid var(--ink);
    flex-shrink: 0;
  }
  .attach span {
    flex: 1;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--muted);
  }
  .pick {
    width: 50px;
    height: 50px;
    flex-shrink: 0;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: #fff4cc;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .pick:disabled {
    opacity: 0.6;
  }
  .viewer {
    z-index: 75;
    background: rgba(22, 30, 60, 0.94);
    display: flex;
    flex-direction: column;
    padding: calc(14px + var(--safe-top)) 14px calc(16px + var(--safe-bottom));
    gap: 12px;
  }
  .vtop {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .vtop a {
    color: var(--ink);
  }
  .vimg {
    flex: 1;
    min-height: 0;
    border: none;
    background: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }
  .vimg img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border: 5px solid #fff;
    border-radius: 4px;
    background: #fff;
  }
  .send {
    width: 50px;
    height: 50px;
    flex-shrink: 0;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: var(--pink-dark);
    color: #fff;
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .send:disabled {
    background: #fff;
    color: #9aa6c8;
    border-color: #9aa6c8;
    box-shadow: none;
    cursor: default;
  }
  .count {
    margin-top: -6px;
    text-align: right;
    font-size: 11px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .count.over {
    color: var(--pink-dark);
  }
</style>
