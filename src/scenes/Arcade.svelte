<script lang="ts">
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import { KARTU_DOA } from '../doa'
  import { onMount } from 'svelte'
  import { sesi, refreshUnread, refreshStreak, api } from '../lib/ruang.svelte'
  import { fade, fly } from 'svelte/transition'
  import { burst } from '../lib/fx'
  import RuangGate from '../components/RuangGate.svelte'
  import AkunSheet from '../components/AkunSheet.svelte'
  import Avatar from '../components/Avatar.svelte'
  import Tanaman from '../components/Tanaman.svelte'
  import Icon from '../components/Icon.svelte'

  const sisa = $derived(config.foto.length - game.collected.length)
  const sisaDoa = $derived(KARTU_DOA.length - game.doa.length)
  const starFound = $derived(game.secrets.includes(2))

  // Ruang Kita: sebelum masuk, kartunya diblur + satu tombol "Buka Ruang Kita" (gerbang PIN di sheet).
  let akun = $state(false)
  let gerbang = $state(false)
  let pinSet = $state<boolean | null>(null)
  let baruBuka = $state(false)
  let sebelumnya = sesi.role
  $effect(() => {
    const r = sesi.role
    if (r && !sebelumnya) {
      // Baru saja masuk: tutup sheet, buka blur dengan sedikit perayaan.
      gerbang = false
      baruBuka = true
      sfx.unlock()
      burst({ small: true, y: 0.55 })
      void refreshUnread()
      setTimeout(() => (baruBuka = false), 1400)
    }
    sebelumnya = r
  })
  onMount(() => {
    if (!sesi.role) api<{ pinSet: boolean }>('auth').then((r) => (pinSet = r.pinSet)).catch(() => {})
    void refreshUnread()
    void refreshStreak()
    const vis = () => {
      if (document.hidden) return
      void refreshUnread()
      void refreshStreak()
    }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  })
</script>

<section class="scene arcade">
  <ArcadeHeader title="" back="surat" coins />

  <div class="sign">
    <span class="hand">selamat datang di</span>
    <strong>ARCADE {config.nama.toUpperCase()}</strong>
    <svg aria-hidden="true" viewBox="0 0 318 94" preserveAspectRatio="none" fill="#FFF4CC" stroke="#23408E" stroke-width="1.4"><circle cx="14" cy="14" r="4" /><circle cx="58" cy="8" r="4" /><circle cx="260" cy="8" r="4" /><circle cx="304" cy="14" r="4" /><circle cx="14" cy="80" r="4" /><circle cx="304" cy="80" r="4" /></svg>
  </div>
  {#if !starFound}
    <button
      class="secret"
      aria-label="Bintang kecil"
      onclick={() => {
        sfx.coin()
        game.findSecret(2)
      }}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#F6D58E" stroke="#23408E" stroke-width="1.6"><path d="M12 2.5l2.6 6 6.4.6-4.9 4.2 1.5 6.3L12 16.3 6.4 19.6l1.5-6.3L3 9.1l6.4-.6z" /></svg>
    </button>
  {/if}

  <button class="card featured" onclick={() => game.go('claw')}>
    <svg aria-hidden="true" viewBox="0 0 118 140" fill="none" stroke="#23408E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="106" height="132" rx="12" fill="#FFC9D9" />
      <rect x="16" y="16" width="86" height="70" rx="6" fill="#E8F4FF" />
      <path d="M16 28 H102" stroke-width="1.6" />
      <path d="M59 28 V44" />
      <path d="M50 44 H68 M52 44 L46 56 L50 60 M66 44 L72 56 L68 60" />
      <circle cx="34" cy="76" r="8" fill="#F6D58E" /><circle cx="52" cy="78" r="7" fill="#9CCBF0" /><circle cx="72" cy="76" r="8" fill="#F28AA5" /><circle cx="88" cy="78" r="6" fill="#C3B1F0" />
      <rect x="16" y="96" width="86" height="30" rx="6" fill="#FFFFFF" />
      <circle cx="36" cy="111" r="6" fill="#23408E" /><path d="M36 111 V102" />
      <circle cx="80" cy="111" r="8" fill="#C93D66" />
    </svg>
    <span class="txt">
      <b>Claw Machine</b>
      <span>{sisa > 0 ? `${sisa} foto lagi nunggu dicapit` : sisaDoa > 0 ? `Diisi ulang: ${sisaDoa} kartu doa` : 'Stok habis. Tahun depan lagi ya'}</span>
      <em>1 koin / main</em>
    </span>
  </button>

  <div class="ruang">
    <div class="ruang-head">
      <h2 class="hand">Ruang Kita</h2>
      {#if sesi.role}
        <button class="chip who" onclick={() => (akun = true)}><Avatar role={sesi.role} size={22} /> {sesi.role === 'parid' ? config.pengirim : config.nama}</button>
      {:else}
        <span class="chip"><Icon name="lock" size={14} stroke={2} /> privat</span>
      {/if}
    </div>
    <div class="kunci-wrap">
    <div class="isi" class:terkunci={!sesi.role} class:baru={baruBuka} inert={!sesi.role} aria-hidden={!sesi.role}>
    <button class="card garden" onclick={() => game.go('taman')}>
      <span class="pot"><Tanaman tahap={sesi.streak?.tahap ?? 0} size={52} diam /></span>
      <span class="txt">
        <b>Taman Kita {#if sesi.streak && sesi.streak.streak > 0}<i>🔥 {sesi.streak.streak}</i>{/if}</b>
        <span>
          {#if !sesi.role}tumbuh kalau kalian sama-sama kirim sesuatu
          {:else if !sesi.streak}…
          {:else if sesi.streak.hariIni.dilla && sesi.streak.hariIni.parid}{sesi.streak.namaTahap} · hari ini sudah disiram 💧
          {:else if sesi.streak.hariIni[sesi.role]}{sesi.streak.namaTahap} · tinggal nunggu {sesi.lawan}
          {:else}{sesi.streak.namaTahap} · hari ini belum disiram{/if}
        </span>
      </span>
    </button>
    <button class="card mail" onclick={() => game.go('kotak')}>
      <svg aria-hidden="true" viewBox="0 0 240 180" fill="none" stroke="#23408E" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 40 L218 36 L222 160 L18 164 Z" fill="#FFFFFF" /><path d="M22 40 L120 110 L218 36" fill="#FBD3DE" /><circle cx="120" cy="110" r="26" fill="#E0557A" stroke-width="6" /></svg>
      <span class="txt">
        <b>Kotak Surat</b>
        <span>{sesi.unread > 0 ? `${sesi.unread} surat baru dari ${sesi.lawan}!` : `Surat-suratan sama ${sesi.role ? sesi.lawan : config.pengirim}`}</span>
      </span>
      {#if sesi.unread > 0}<em class="badge" aria-label="{sesi.unread} belum dibaca">{sesi.unread > 9 ? '9+' : sesi.unread}</em>{/if}
    </button>
    <div class="grid two">
      <button class="card" style="background:#E3F4EE" onclick={() => game.go('kenangan')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#23408E" stroke-width="1.8" stroke-linejoin="round"><rect x="6" y="3" width="14" height="14" rx="1.5" transform="rotate(8 13 10)" fill="#FFC9D9" /><rect x="3" y="6" width="14" height="14" rx="1.5" /><path d="M3 16l4-4 3 3 2-2 5 5" fill="none" /></svg>
        <b>Album Kenangan</b><span>kamu & {config.pengirim} bisa upload</span>
      </button>
      <button class="card" style="background:#ECE4FF" onclick={() => game.go('kapsul')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="#E8F4FF" stroke="#23408E" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="2" width="8" height="3" rx="1" fill="#C3B1F0" /><path d="M8.5 5 C5 7 4.5 10 4.5 13 V19 a2.5 2.5 0 0 0 2.5 2.5 H17 a2.5 2.5 0 0 0 2.5-2.5 V13 C19.5 10 19 7 15.5 5 Z" /><path d="M8 13 l4 3 l4 -3" fill="none" /></svg>
        <b>Kapsul Waktu</b><span>surat buat dibuka nanti</span>
      </button>
    </div>
    </div>
    {#if !sesi.role}
      <div class="kunci" transition:fade={{ duration: 400 }}>
        <svg aria-hidden="true" viewBox="0 0 120 120" fill="none" stroke="#23408E" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M36 54 V40 a24 24 0 0 1 48 0 V54" />
          <rect x="22" y="52" width="76" height="58" rx="14" fill="#FFC9D9" />
          <path d="M60 92 s-13-8-13-17 a7 7 0 0 1 13-3 a7 7 0 0 1 13 3 c0 9-13 17-13 17z" fill="#E0557A" stroke-width="2.6" />
        </svg>
        <p class="hand">Khusus {config.nama} & {config.pengirim}</p>
        <small>surat, album, kapsul waktu, dan taman kalian</small>
        <button class="btn pink" onclick={() => (gerbang = true)}>
          <Icon name="unlock" />
          {pinSet === false ? 'Bikin PIN dulu' : 'Buka Ruang Kita'}
        </button>
      </div>
    {/if}
    </div>
  </div>

  <div class="grid">
    <button class="card" style="background:#FFF4CC" onclick={() => game.go('album')}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#23408E" stroke-width="1.8" stroke-linejoin="round"><path d="M4 4h12l4 4v12H4z" /><path d="M4 15l4-4 4 4 3-3 5 5" fill="none" /><circle cx="15" cy="9" r="1.6" fill="#F28AA5" /></svg>
      <b>Album</b><span>{game.collected.length}/{config.foto.length} terkumpul</span>
    </button>
    <button class="card" style="background:#FFE3EA" onclick={() => game.go('photobooth')}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#23408E" stroke-width="1.8" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" fill="#CFE6F7" /></svg>
      <b>Photobooth</b><span>selfie + doodle</span>
    </button>
    <button class="card" style="background:#E3F0FF" onclick={() => game.go('memory')}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#23408E" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="8" height="12" rx="1.5" transform="rotate(-8 7 11)" /><rect x="12" y="6" width="8" height="12" rx="1.5" fill="#FFC9D9" transform="rotate(8 16 12)" /></svg>
      <b>Memory Match</b><span>cari pasangannya</span>
    </button>
    <button class="card" style="background:#ECE4FF" onclick={() => game.go('tebak')}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#23408E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5" fill="#FFFFFF" /><path d="M15.5 15.5L21 21" /><path d="M8.5 9a2 2 0 1 1 2.6 1.9c-.6.2-.6.6-.6 1.1M10.5 13.6v.2" /></svg>
      <b>Tebak Foto</b><span>makin lama makin jelas</span>
    </button>
    <button class="card wide" style="background:#FFF0B3" onclick={() => game.go('lari')}>
      <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="#23408E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 42 L32 42 L35 28 L13 28 Z" fill="#F28AA5" />
        <path d="M11 28 C6 22 13 16 18 19 C19 11 29 11 30 19 C35 16 42 22 37 28 Z" fill="#FFFDF5" />
        <rect x="22.5" y="8" width="3" height="9" fill="#CFE6F7" />
        <path d="M24 2 C27 6 26 8 24 8 C22 8 21 6 24 2 Z" fill="#F6D58E" stroke-width="1.6" />
        <circle cx="20" cy="34" r="1.3" fill="#23408E" /><circle cx="28" cy="34" r="1.3" fill="#23408E" />
        <path d="M4 38 h5 M2 32 h6" stroke="#9AA6C8" />
      </svg>
      <span class="txt">
        <b>Lari Cupcake</b>
        <span>{game.best > 0 ? `Rekor kamu: ${game.best.toLocaleString('id-ID')}` : 'Lompati brokoli, kumpulin lilin'}</span>
      </span>
      <em>NEW</em>
    </button>
  </div>

  <p class="hand tagline">main sepuasnya, birthday girl</p>
  <div class="floor" aria-hidden="true"></div>
</section>

{#if akun}<AkunSheet onclose={() => (akun = false)} />{/if}

{#if gerbang && !sesi.role}
  <div class="gback overlay-fixed" role="presentation" onclick={() => (gerbang = false)} transition:fade={{ duration: 150 }}></div>
  <div class="gsheet overlay-fixed" role="dialog" aria-modal="true" aria-label="Masuk Ruang Kita" transition:fly={{ y: 320, duration: 280 }}>
    <button class="icon-btn gclose" aria-label="Tutup" onclick={() => (gerbang = false)}><Icon name="close" /></button>
    <RuangGate alasan="Satu PIN untuk membuka semuanya: Kotak Surat, Album Kenangan, Kapsul Waktu, dan Taman Kita.">
      <span></span>
    </RuangGate>
  </div>
{/if}

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .sign {
    position: relative;
    margin: 0 12px;
    padding: 16px 10px;
    border: 2.5px solid var(--ink);
    border-radius: 22px;
    background: #ffc9d9;
    box-shadow: 4px 4px 0 var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .sign .hand {
    font-size: 24px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .sign strong {
    font-weight: 900;
    font-size: clamp(24px, 8vw, 32px);
    letter-spacing: 2px;
    line-height: 1.15;
  }
  .sign svg {
    position: absolute;
    inset: 2px;
    width: calc(100% - 4px);
    height: calc(100% - 4px);
  }
  .secret {
    position: absolute;
    right: 8px;
    top: calc(170px + var(--safe-top));
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    border: 2.5px solid var(--ink);
    border-radius: 20px 16px 22px 17px;
    box-shadow: 4px 4px 0 var(--ink);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px;
    text-align: left;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .card:active {
    transform: translate(3px, 3px);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .card svg {
    width: 34px;
    height: 34px;
  }
  .card b {
    font-weight: 900;
    font-size: 17px;
  }
  .card span {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .featured {
    margin-top: 22px;
    background: #cdefe3;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .featured svg {
    width: 96px;
    height: 114px;
    flex-shrink: 0;
  }
  .featured .txt {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .featured b {
    font-size: 22px;
    line-height: 1.1;
  }
  .featured span {
    font-size: 14px;
    font-weight: 600;
  }
  .featured em {
    align-self: flex-start;
    margin-top: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    font-style: normal;
  }
  .grid {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    flex-shrink: 0;
  }
  .card.wide {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    position: relative;
  }
  .card.wide svg {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }
  .card.wide .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .card.wide em {
    position: absolute;
    top: -10px;
    right: 12px;
    padding: 3px 10px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--pink-dark);
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    font-style: normal;
    letter-spacing: 1px;
    rotate: 4deg;
  }
  .ruang {
    margin-top: 22px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 12px 14px;
    border: 2.5px dashed var(--ink);
    border-radius: 22px 18px 24px 19px;
    background: rgba(255, 255, 255, 0.55);
  }
  .kunci-wrap {
    position: relative;
  }
  .isi {
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition:
      filter 0.7s ease,
      opacity 0.7s ease;
  }
  .isi.terkunci {
    filter: blur(5px) saturate(0.7);
    opacity: 0.7;
    pointer-events: none;
    user-select: none;
  }
  .isi.baru {
    animation: terbuka 0.9s ease-out;
  }
  @keyframes terbuka {
    0% {
      scale: 0.97;
    }
    60% {
      scale: 1.02;
    }
    100% {
      scale: 1;
    }
  }
  .kunci {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 4px;
    padding: 12px;
  }
  .kunci svg {
    width: 64px;
    height: 64px;
    filter: drop-shadow(2px 2px 0 rgba(35, 64, 142, 0.25));
  }
  .kunci .hand {
    font-size: 28px;
    line-height: 1;
    color: var(--pink-dark);
    text-shadow: 0 0 8px #fff, 0 0 2px #fff;
  }
  .kunci small {
    font-size: 12.5px;
    font-weight: 800;
    color: var(--ink);
    text-shadow: 0 0 6px #fff, 0 0 2px #fff;
  }
  .kunci .btn {
    margin-top: 10px;
    min-height: 50px;
  }
  .gback {
    z-index: 70;
    background: rgba(22, 40, 90, 0.4);
  }
  .gsheet {
    z-index: 71;
    top: auto;
    max-height: 92%;
    overflow-y: auto;
    background: var(--arcade-bg);
    border-top: 2.5px solid var(--ink);
    border-radius: 24px 24px 0 0;
    padding: 18px 18px calc(18px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
  }
  .gclose {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 1;
  }
  .ruang-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ruang-head h2 {
    font-size: 30px;
    line-height: 1;
    color: var(--pink-dark);
  }
  .who {
    cursor: pointer;
    padding-left: 4px;
  }
  .card.garden {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    background: #e3f4ee;
    padding: 8px 14px 8px 8px;
  }
  .card.garden .pot {
    width: 56px;
    height: 60px;
    flex-shrink: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .card.garden .pot :global(svg) {
    width: 52px;
    height: 57px;
  }
  .card.garden .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .card.garden b i {
    font-style: normal;
    font-size: 14px;
    margin-left: 4px;
    padding: 1px 8px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff4cc;
  }
  .card.mail {
    position: relative;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    background: #ffe3ea;
  }
  .card.mail svg {
    width: 56px;
    height: 42px;
    flex-shrink: 0;
  }
  .card.mail .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .card.mail b {
    font-size: 19px;
  }
  .badge {
    position: absolute;
    top: -10px;
    right: -6px;
    min-width: 28px;
    height: 28px;
    padding: 0 7px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--pink-dark);
    color: #fff;
    font-size: 13px;
    font-weight: 900;
    font-style: normal;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bob 1.6s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      translate: 0 -3px;
    }
  }
  .grid.two {
    margin-top: 0;
  }
  .tagline {
    margin-top: 18px;
    text-align: center;
    font-size: 26px;
    position: relative;
    z-index: 1;
  }
  .floor {
    margin: auto -20px calc(-24px - var(--safe-bottom));
    min-height: 70px;
    flex-shrink: 0;
    border-top: 2.5px solid var(--ink);
    background-color: #fff;
    background-image: conic-gradient(#ffc9d9 25%, transparent 0 50%, #ffc9d9 0 75%, transparent 0);
    background-size: 40px 40px;
  }
</style>
