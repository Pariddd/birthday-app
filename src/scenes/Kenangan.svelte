<script lang="ts">
  import { fade, fly, scale } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, api, ApiError, waktu, tutupNotif, type Role } from '../lib/ruang.svelte'
  import { sfx } from '../lib/audio'
  import { burst } from '../lib/fx'
  import { game } from '../lib/state.svelte'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import RuangGate from '../components/RuangGate.svelte'
  import Icon from '../components/Icon.svelte'
  import Avatar from '../components/Avatar.svelte'
  import { kompres, posterVideo } from '../lib/foto'

  type Item = { id: string; by: Role; caption: string; at: number; w: number; h: number; love: Role[]; src: string; video?: { dur: number }; videoSrc?: string }
  type Pending = {
    key: number
    url: string
    blob: Blob | null // foto (sudah dikompres) atau poster video
    w: number
    h: number
    caption: string
    status: 'siap' | 'kirim' | 'gagal' | 'ok'
    err?: string
    file?: File // video asli
    dur?: number
    progress?: number
  }
  type VideoCfg = { langsung: boolean; maxBytes: number; maxLewatFungsi: number; maxDurasi: number }

  const ROT = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2]

  let items = $state<Item[]>([])
  let max = $state(400)
  let loaded = $state(false)
  let error = $state('')
  let pending = $state<Pending[]>([])
  let uploading = $state(false)
  let open = $state<number | null>(null)
  let picker = $state<HTMLInputElement>()
  let pkey = 0
  let vcfg = $state<VideoCfg | null>(null)
  const MB = (b: number) => `${Math.round(b / 1024 / 1024)} MB`
  const durasi = (d: number) => `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}`

  const me = $derived(sesi.role)
  const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)
  const cur = $derived(open !== null ? items[open] : null)

  async function load() {
    try {
      const r = await api<{ items: Item[]; max: number; video: VideoCfg }>('album')
      items = r.items
      max = r.max
      vcfg = r.video
      error = ''
      void tutupNotif('album')
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) error = e.message
    } finally {
      loaded = true
    }
  }
  $effect(() => {
    if (me && !loaded) void load()
  })

  async function pilih(e: Event) {
    const files = [...((e.currentTarget as HTMLInputElement).files ?? [])].slice(0, 10)
    ;(e.currentTarget as HTMLInputElement).value = ''
    if (!files.length) return
    const baru: Pending[] = files.map((f) => ({ key: pkey++, url: '', blob: null, w: 0, h: 0, caption: '', status: 'siap' }))
    pending = [...pending, ...baru]
    for (let i = 0; i < files.length; i++) {
      const k = baru[i].key
      const f = files[i]
      if (f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name)) {
        await siapkanVideo(k, f)
        continue
      }
      try {
        const r = await kompres(f)
        pending = pending.map((p) => (p.key === k ? { ...p, ...r, url: URL.createObjectURL(r.blob) } : p))
      } catch {
        pending = pending.map((p) => (p.key === k ? { ...p, status: 'gagal', err: 'File ini tidak bisa dibaca sebagai foto.' } : p))
      }
    }
  }

  async function siapkanVideo(k: number, f: File) {
    const gagal = (err: string) => (pending = pending.map((p) => (p.key === k ? { ...p, status: 'gagal' as const, err } : p)))
    const batas = vcfg ? (vcfg.langsung ? vcfg.maxBytes : vcfg.maxLewatFungsi) : 4 * 1024 * 1024
    if (f.size > batas) return gagal(`Videonya ${MB(f.size)}, maksimal ${MB(batas)}. Potong dulu ya.`)
    try {
      const r = await posterVideo(f)
      if (vcfg && r.dur > vcfg.maxDurasi + 1) return gagal(`Videonya ${durasi(r.dur)}, maksimal ${durasi(vcfg.maxDurasi)}. Potong dulu ya.`)
      pending = pending.map((p) => (p.key === k ? { ...p, blob: r.blob, w: r.w, h: r.h, dur: r.dur, file: f, url: URL.createObjectURL(r.blob) } : p))
    } catch {
      gagal('Video ini tidak bisa dibaca di browser ini (formatnya). Coba rekam ulang / kirim dalam MP4.')
    }
  }

  const idAcak = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('')

  /** Unggah file video → id-nya di server. Coba langsung ke Blob dulu, cadangannya lewat fungsi (video kecil). */
  async function unggahVideo(p: Pending): Promise<string> {
    const f = p.file!
    const type = f.type || 'video/mp4'
    const progres = (n: number) => (pending = pending.map((x) => (x.key === p.key ? { ...x, progress: n } : x)))
    if (vcfg?.langsung) {
      try {
        const { uploadPresigned } = await import('@vercel/blob/client')
        const vid = idAcak()
        await uploadPresigned(`video/${vid}`, f, {
          access: 'private',
          contentType: type,
          handleUploadUrl: '/api/album',
          headers: { authorization: `Bearer ${sesi.token}` },
          multipart: f.size > 8 * 1024 * 1024,
          onUploadProgress: (e) => progres(Math.round(e.percentage)),
        })
        return vid
      } catch (e) {
        console.warn('upload langsung gagal', e)
        if (f.size > (vcfg?.maxLewatFungsi ?? 0)) throw new ApiError(0, 'Upload videonya gagal. Coba lagi ya (pastikan internetnya stabil).')
      }
    }
    progres(10)
    const r = await api<{ vid: string }>('album?unggah=video', { method: 'POST', raw: f, headers: { 'content-type': type } })
    progres(100)
    return r.vid
  }

  function buang(k: number) {
    const p = pending.find((x) => x.key === k)
    if (p?.url) URL.revokeObjectURL(p.url)
    pending = pending.filter((x) => x.key !== k)
  }

  async function uploadSemua() {
    if (uploading) return
    uploading = true
    let ok = 0
    for (const p of pending) {
      if (!p.blob || p.status === 'ok') continue
      pending = pending.map((x) => (x.key === p.key ? { ...x, status: 'kirim', err: undefined } : x))
      try {
        const extra: Record<string, string> = {}
        if (p.file) {
          extra['x-video'] = await unggahVideo(p)
          extra['x-dur'] = String(Math.round(p.dur ?? 0))
        }
        const r = await api<{ item: Item }>('album', {
          method: 'POST',
          raw: p.blob,
          headers: { 'content-type': 'image/jpeg', 'x-caption': encodeURIComponent(p.caption.trim()), 'x-w': String(p.w), 'x-h': String(p.h), ...extra },
        })
        items = [r.item, ...items]
        pending = pending.map((x) => (x.key === p.key ? { ...x, status: 'ok' } : x))
        ok++
      } catch (e) {
        pending = pending.map((x) => (x.key === p.key ? { ...x, status: 'gagal', err: e instanceof ApiError ? e.message : 'Gagal upload' } : x))
      }
    }
    uploading = false
    for (const p of pending.filter((x) => x.status === 'ok')) buang(p.key)
    if (ok) {
      sfx.shutter()
      game.say(ok === 1 ? 'Masuk album!' : `${ok} file masuk album!`)
    }
  }

  async function love(it: Item) {
    if (!me) return
    const on = !it.love.includes(me)
    const apply = (l: Role[]) => (items = items.map((x) => (x.id === it.id ? { ...x, love: l } : x)))
    apply(on ? [...it.love, me] : it.love.filter((r) => r !== me))
    if (on) {
      sfx.pop()
      if (it.love.length === 1) burst({ small: true, y: 0.45 }) // dua-duanya suka
    }
    try {
      await api('album', { method: 'PATCH', body: { id: it.id, love: on } })
    } catch {
      apply(it.love)
    }
  }

  async function hapus(it: Item) {
    if (!confirm('Hapus foto ini dari album? Tidak bisa dibatalkan.')) return
    try {
      await api(`album?id=${it.id}`, { method: 'DELETE' })
      items = items.filter((x) => x.id !== it.id)
      open = null
      game.say('Fotonya dihapus.')
    } catch (e) {
      game.say(e instanceof ApiError ? e.message : 'Gagal menghapus')
    }
  }

  function geser(d: number) {
    if (open === null || !items.length) return
    open = (open + d + items.length) % items.length
  }
  function key(e: KeyboardEvent) {
    if (open === null) return
    if (e.key === 'Escape') open = null
    else if (e.key === 'ArrowRight') geser(1)
    else if (e.key === 'ArrowLeft') geser(-1)
  }
  let sx = 0
</script>

<svelte:window onkeydown={key} />

<section class="scene arcade kenangan">
  <ArcadeHeader title="Album Kenangan" />

  <RuangGate alasan="Album bersama: kamu dan {config.pengirim} sama-sama bisa nambah foto. Cuma kalian berdua yang bisa lihat.">
    <div class="top">
      <p class="sub">Foto & video kalian berdua · {items.length}/{max}</p>
      <button class="btn pink add" onclick={() => picker?.click()} disabled={uploading}><Icon name="plus" /> Tambah</button>
      <input bind:this={picker} class="sr-only" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.mp4" multiple onchange={pilih} tabindex="-1" aria-hidden="true" />
    </div>

    {#if error}<p class="err" role="alert">{error} <button class="link" onclick={load}>Coba lagi</button></p>{/if}

    {#if !loaded}
      <p class="hand wait">membuka album…</p>
    {:else if items.length === 0}
      <div class="empty">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#23408E" stroke-width="1.4" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" fill="none" /><circle cx="15.5" cy="9" r="1.6" fill="#F28AA5" /></svg>
        <p class="hand">Albumnya masih kosong</p>
        <p>Foto pertama dari siapa nih? Kamu atau {sesi.lawan}?</p>
      </div>
    {:else}
      <div class="grid">
        {#each items as it, i (it.id)}
          <button class="pol" style="rotate:{ROT[i % ROT.length]}deg" onclick={() => (open = i)} in:scale={{ start: 0.9, duration: 250 }}>
            <span class="media">
              <img src={it.src} alt={it.caption || `${it.video ? 'Video' : 'Foto'} dari ${nama(it.by)}`} loading="lazy" decoding="async" width={it.w || undefined} height={it.h || undefined} />
              {#if it.video}<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5l11 7-11 7z" fill="#fff" /></svg></span><span class="dur">{durasi(it.video.dur)}</span>{/if}
            </span>
            {#if it.caption}<span class="cap hand">{it.caption}</span>{/if}
            <span class="foot">
              <span class="by" class:dilla={it.by === 'dilla'}><Avatar role={it.by} size={16} /> {nama(it.by)}</span>
              {#if it.love.length}<span class="hearts" aria-label="{it.love.length} suka">{'♥'.repeat(it.love.length)}</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </RuangGate>
</section>

{#if pending.length}
  <div class="back overlay-fixed" transition:fade={{ duration: 150 }}></div>
  <div class="sheet overlay-fixed" role="dialog" aria-modal="true" aria-labelledby="up-t" transition:fly={{ y: 300, duration: 280 }}>
    <h3 id="up-t" class="hand">Tambah ke album</h3>
    <div class="plist">
      {#each pending as p (p.key)}
        <div class="pitem" class:bad={p.status === 'gagal'}>
          <span class="thumbwrap">
            {#if p.url}<img src={p.url} alt="" />{:else}<div class="thumb ph"></div>{/if}
            {#if p.file}<span class="vbadge">▶ {durasi(p.dur ?? 0)}</span>{/if}
          </span>
          <div class="pmeta">
            <input type="text" maxlength="140" placeholder="Kasih keterangan (opsional)" bind:value={p.caption} disabled={p.status === 'kirim'} />
            {#if p.status === 'kirim'}
              <span class="st">mengunggah{p.file && p.progress !== undefined ? ` ${p.progress}%` : '…'}</span>
              {#if p.file}<span class="pbar"><span style="width:{p.progress ?? 0}%"></span></span>{/if}
            {/if}
            {#if p.err}<span class="st bad">{p.err}</span>{/if}
          </div>
          <button class="icon-btn" aria-label="Batal" onclick={() => buang(p.key)} disabled={p.status === 'kirim'}><Icon name="close" size={18} /></button>
        </div>
      {/each}
    </div>
    <div class="acts">
      <button class="btn ghost" onclick={() => [...pending].forEach((p) => buang(p.key))} disabled={uploading}>Batal</button>
      <button class="btn pink grow" onclick={uploadSemua} disabled={uploading || !pending.some((p) => p.blob && p.status !== 'ok')}>
        {uploading ? 'Mengunggah…' : `Upload ${pending.filter((p) => p.blob).length} file`}
      </button>
    </div>
  </div>
{/if}

{#if cur && open !== null}
  <div class="lb overlay-fixed" role="dialog" aria-modal="true" aria-label="Foto" transition:fade={{ duration: 180 }}>
    <div class="lb-top">
      <span class="chip">{open + 1}/{items.length}</span>
      <button class="icon-btn" aria-label="Tutup" onclick={() => (open = null)}><Icon name="close" /></button>
    </div>
    <div
      class="lb-img"
      role="presentation"
      ontouchstart={(e) => (sx = e.touches[0].clientX)}
      ontouchend={(e) => {
        const dx = e.changedTouches[0].clientX - sx
        if (Math.abs(dx) > 50) geser(dx < 0 ? 1 : -1)
      }}
    >
      {#key cur.id}
        {#if cur.videoSrc}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={cur.videoSrc} poster={cur.src} controls playsinline preload="metadata" in:fade={{ duration: 200 }}></video>
        {:else}
          <img src={cur.src} alt={cur.caption || `Foto dari ${nama(cur.by)}`} in:fade={{ duration: 200 }} />
        {/if}
      {/key}
    </div>
    <div class="lb-card">
      {#if cur.caption}<p class="hand lb-cap">{cur.caption}</p>{/if}
      <p class="lb-meta"><Avatar role={cur.by} size={22} /> dari <b>{nama(cur.by)}</b> · {waktu(cur.at)}</p>
      <div class="lb-acts">
        <button class="icon-btn" aria-label="Sebelumnya" onclick={() => geser(-1)}><Icon name="left" /></button>
        <button class="lovebtn" class:on={me && cur.love.includes(me)} aria-pressed={!!me && cur.love.includes(me)} onclick={() => love(cur)}>
          <Icon name="heart" size={20} />
          {cur.love.length === 2 ? 'kalian berdua suka' : cur.love.length === 1 ? (cur.love[0] === me ? 'kamu suka' : `${nama(cur.love[0])} suka`) : 'suka'}
        </button>
        {#if me && (cur.by === me || me === 'parid')}
          <button class="icon-btn" aria-label="Hapus foto" onclick={() => hapus(cur)}><Icon name="trash" /></button>
        {/if}
        <button class="icon-btn" aria-label="Berikutnya" onclick={() => geser(1)}><Icon name="right" /></button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scene.kenangan {
    padding-left: 18px;
    padding-right: 18px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
    flex-shrink: 0;
  }
  .sub {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .add {
    min-height: 46px;
    padding: 0 16px;
    font-size: 15px;
  }
  .err {
    font-size: 13px;
    font-weight: 800;
    color: var(--pink-dark);
    margin-bottom: 10px;
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
    text-align: center;
    margin-top: 40px;
    font-size: 26px;
    color: var(--muted-2);
  }
  .empty {
    margin: 30px auto 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
  }
  .empty svg {
    width: 90px;
    height: 90px;
  }
  .empty .hand {
    font-size: 28px;
    color: var(--ink);
  }
  /* Masonry sederhana: 2 kolom, foto potret & lanskap tetap proporsional */
  .grid {
    columns: 2;
    column-gap: 14px;
    padding: 4px 4px 20px;
  }
  .pol {
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: 16px;
    padding: 8px 8px 6px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 4px;
    box-shadow: 3px 3px 0 rgba(35, 64, 142, 0.3);
    cursor: pointer;
    text-align: left;
    gap: 4px;
  }
  .pol img {
    display: block;
    width: 100%;
    height: auto;
    min-height: 60px;
    border: 1.5px solid var(--ink);
    background: #eef3fb;
    object-fit: cover;
  }
  .cap {
    font-size: 19px;
    line-height: 1.05;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .by {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding-left: 2px !important;
    font-size: 10.5px;
    font-weight: 900;
    padding: 1px 7px;
    border-radius: 999px;
    background: #e3f0ff;
    color: var(--ink);
  }
  .by.dilla {
    background: var(--pink-soft);
  }
  .hearts {
    color: var(--pink-dark);
    font-size: 13px;
    letter-spacing: 1px;
  }

  .back {
    z-index: 70;
    background: rgba(22, 40, 90, 0.4);
  }
  .sheet {
    z-index: 71;
    top: auto;
    max-height: 85%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--paper);
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 18px 18px calc(18px + var(--safe-bottom));
  }
  .sheet h3 {
    font-size: 32px;
    color: var(--pink-dark);
  }
  .plist {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }
  .media {
    position: relative;
    display: block;
  }
  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: 42px;
    height: 42px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: rgba(22, 40, 90, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 3px;
  }
  .dur {
    position: absolute;
    right: 5px;
    bottom: 5px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(22, 40, 90, 0.75);
    color: #fff;
    font-size: 10.5px;
    font-weight: 800;
  }
  .thumbwrap {
    position: relative;
    flex-shrink: 0;
  }
  .vbadge {
    position: absolute;
    left: 3px;
    bottom: 3px;
    padding: 0 5px;
    border-radius: 6px;
    background: rgba(22, 40, 90, 0.8);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
  }
  .pbar {
    display: block;
    height: 6px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .pbar span {
    display: block;
    height: 100%;
    background: var(--pink-dark);
    transition: width 0.2s;
  }
  .pitem {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
  }
  .pitem.bad {
    border-style: dashed;
  }
  .pitem img,
  .thumb {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 8px;
    border: 1.5px solid var(--ink);
    flex-shrink: 0;
  }
  .pmeta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pmeta input {
    width: 100%;
    height: 44px;
    padding: 0 10px;
    border: 2px solid var(--line);
    border-radius: 10px;
    font: inherit;
    font-size: 16px;
    color: var(--text);
  }
  .pmeta input:focus {
    outline: none;
    border-color: var(--ink);
  }
  .st {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .st.bad {
    color: var(--pink-dark);
  }
  .acts {
    display: flex;
    gap: 10px;
  }
  .grow {
    flex: 1;
  }

  .lb {
    z-index: 75;
    background: rgba(22, 30, 60, 0.92);
    display: flex;
    flex-direction: column;
    padding: calc(14px + var(--safe-top)) 14px calc(16px + var(--safe-bottom));
    gap: 12px;
  }
  .lb-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lb-img {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: pan-y;
  }
  .lb-img video {
    max-width: 100%;
    max-height: 100%;
    border: 6px solid #fff;
    border-radius: 3px;
    background: #000;
  }
  .lb-img img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border: 6px solid #fff;
    border-bottom-width: 18px;
    border-radius: 3px;
    background: #fff;
  }
  .lb-card {
    background: var(--paper);
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lb-cap {
    font-size: 24px;
    line-height: 1.1;
    color: var(--ink);
  }
  .lb-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--muted);
  }
  .lb-acts {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lovebtn {
    flex: 1;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    color: var(--ink);
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
  }
  .lovebtn.on {
    background: var(--pink-soft);
    color: var(--pink-dark);
  }
  .lovebtn.on :global(svg) {
    fill: var(--pink);
  }
</style>
