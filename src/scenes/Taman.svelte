<script lang="ts">
  import { onMount } from 'svelte'
  import { scale } from 'svelte/transition'
  import { config } from '../config'
  import { sesi, refreshStreak, type Role } from '../lib/ruang.svelte'
  import { game } from '../lib/state.svelte'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import RuangGate from '../components/RuangGate.svelte'
  import Avatar from '../components/Avatar.svelte'
  import Tanaman from '../components/Tanaman.svelte'
  import Icon from '../components/Icon.svelte'

  const s = $derived(sesi.streak)
  const me = $derived(sesi.role)
  const nama = (r: Role) => (r === 'dilla' ? config.nama : config.pengirim)
  const lain = $derived<Role>(me === 'dilla' ? 'parid' : 'dilla')

  const persen = $derived.by(() => {
    if (!s || !s.berikut) return 100
    const dari = s.tahapList[s.tahap].min
    const ke = s.tahapList[s.tahap + 1].min
    return Math.round(((s.streak - dari) / (ke - dari)) * 100)
  })
  const hariIniLengkap = $derived(!!s && s.hariIni.dilla && s.hariIni.parid)
  const hari = (tgl: string) => new Date(tgl + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'narrow' })
  const tglPendek = (tgl: string) => Number(tgl.slice(8))

  $effect(() => {
    if (me) void refreshStreak()
  })
  onMount(() => {
    const vis = () => !document.hidden && refreshStreak()
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  })
</script>

<section class="scene arcade taman">
  <ArcadeHeader title="Taman Kita" />

  <RuangGate alasan="Tanaman kalian berdua: tumbuh tiap hari kamu dan {config.pengirim} sama-sama mengirim sesuatu.">
    {#if !s}
      <p class="hand wait">menengok taman…</p>
    {:else}
      <div class="garden" in:scale={{ start: 0.94, duration: 300 }}>
        <div class="sky" aria-hidden="true"></div>
        <Tanaman tahap={s.tahap} size={210} />
        <div class="count">
          <b>{s.streak}</b>
          <span class="hand">hari berturut-turut</span>
        </div>
        <span class="stage" class:legend={s.tahap === 7}>{s.namaTahap}</span>
      </div>

      {#if s.berikut}
        <div class="next">
          <div class="bar"><div style="width:{persen}%"></div></div>
          <p>{s.berikut.sisa} hari lagi jadi <b>{s.berikut.nama}</b></p>
        </div>
      {:else}
        <p class="next done hand">Tahap tertinggi! Tamannya sudah legendaris ✨</p>
      {/if}

      <div class="today" class:full={hariIniLengkap}>
        <p class="ttl">{hariIniLengkap ? 'Hari ini sudah disiram berdua 💧' : 'Siraman hari ini'}</p>
        <div class="who">
          {#each [me!, lain] as r (r)}
            <div class="p" class:ok={s.hariIni[r]}>
              <Avatar role={r} size={40} />
              <span>{r === me ? 'Kamu' : nama(r)}</span>
              <em>{s.hariIni[r] ? 'sudah ✓' : 'belum'}</em>
            </div>
          {/each}
        </div>
        {#if !s.hariIni[me!]}
          <button class="btn pink" onclick={() => game.go('kotak')}><Icon name="mail" /> Siram: kirim surat</button>
        {/if}
      </div>

      <div class="cal" aria-label="14 hari terakhir">
        {#each s.kalender as k (k.tgl)}
          {@const full = k.d && k.p}
          <div class="day" class:kini={k.tgl === s.hariIniTgl}>
            <span class="dot" class:full class:half={!full && (k.d || k.p)} class:beku={k.beku}>
              {#if k.beku}🛡️{:else if full}💧{/if}
            </span>
            <small>{tglPendek(k.tgl)}</small>
            <small class="wd">{hari(k.tgl)}</small>
          </div>
        {/each}
      </div>

      <div class="stats">
        <div><b>{s.best}</b><span>rekor terpanjang</span></div>
        <div><b>{'🛡️'.repeat(s.freezes) || '–'}</b><span>pelindung ({s.freezes}/2)</span></div>
      </div>

      <div class="how">
        <p><b>Cara menyiram:</b> kirim apa aja hari ini, entah surat, foto, foto album, atau kapsul waktu. Tanaman tumbuh di hari kalian <b>berdua</b> sama-sama menyiram (hitungan hari WIB).</p>
        <p><b>Pelindung 🛡️:</b> dapat 1 tiap 7 hari berturut-turut (maks. 2). Kalau ada hari yang terlewat, pelindung dipakai otomatis supaya tamannya tidak layu.</p>
      </div>

      <h2 class="hand sec">Tahap-tahap taman</h2>
      <div class="stages">
        {#each s.tahapList as t, i (i)}
          <div class="st" class:now={i === s.tahap} class:future={i > s.tahap}>
            <Tanaman tahap={i} size={64} diam />
            <b>{t.nama}</b>
            <small>{i === 0 ? 'awal' : `${t.min} hari`}</small>
          </div>
        {/each}
      </div>
    {/if}
  </RuangGate>
</section>

<style>
  .scene.taman {
    padding-left: 18px;
    padding-right: 18px;
  }
  .wait {
    margin-top: 40px;
    text-align: center;
    font-size: 26px;
    color: var(--muted-2);
  }
  .garden {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 18px 12px 14px;
    border: 2.5px solid var(--ink);
    border-radius: 22px 18px 24px 19px;
    box-shadow: 4px 4px 0 var(--ink);
    overflow: hidden;
    background: #fbf8f1;
  }
  .sky {
    position: absolute;
    inset: 0 0 38% 0;
    background: linear-gradient(#dff0ff, #fbf8f1);
  }
  .garden :global(svg) {
    position: relative;
  }
  .count {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;
  }
  .count b {
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .count span {
    font-size: 24px;
    color: var(--pink-dark);
  }
  .stage {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #e3f4ee;
    font-size: 12px;
    font-weight: 900;
    rotate: 4deg;
  }
  .stage.legend {
    background: #f6d58e;
  }
  .next {
    margin-top: 14px;
    flex-shrink: 0;
  }
  .next .bar {
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }
  .next .bar div {
    height: 100%;
    background: #8ed3be;
    transition: width 0.6s;
  }
  .next p {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-align: center;
  }
  .next.done {
    text-align: center;
    font-size: 24px;
    color: #8a6414;
  }
  .today {
    margin-top: 16px;
    flex-shrink: 0;
    padding: 14px;
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .today.full {
    background: #e3f4ee;
  }
  .ttl {
    font-weight: 900;
    font-size: 15px;
  }
  .who {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .p {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 2px dashed #9aa6c8;
    border-radius: 14px;
  }
  .p.ok {
    border-style: solid;
    border-color: var(--ink);
    background: #f2fbf7;
  }
  .p span {
    flex: 1;
    font-weight: 800;
    font-size: 14px;
  }
  .p em {
    font-style: normal;
    font-size: 12px;
    font-weight: 800;
    color: var(--muted-2);
  }
  .p.ok em {
    color: #2f8a6b;
  }
  .today .btn {
    min-height: 48px;
  }
  .cal {
    margin-top: 16px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 3px;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .dot {
    width: 100%;
    max-width: 24px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid #c9d2e6;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
  }
  .dot.half {
    border-color: var(--ink);
    background: linear-gradient(90deg, #b7e6d6 50%, #fff 50%);
  }
  .dot.full {
    border-color: var(--ink);
    background: #8ed3be;
  }
  .dot.beku {
    border-color: var(--ink);
    background: #e3f0ff;
  }
  .day small {
    font-size: 9.5px;
    font-weight: 800;
    color: var(--muted-2);
    line-height: 1;
  }
  .day.kini small {
    color: var(--pink-dark);
  }
  .day.kini .dot {
    outline: 2px solid var(--pink);
    outline-offset: 1px;
  }
  .stats {
    margin-top: 16px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .stats div {
    padding: 10px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .stats b {
    font-size: 22px;
    font-weight: 900;
    line-height: 1.1;
  }
  .stats span {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--muted);
  }
  .how {
    margin-top: 16px;
    flex-shrink: 0;
    display: grid;
    gap: 8px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
  }
  .sec {
    margin-top: 22px;
    font-size: 28px;
    line-height: 1;
  }
  .stages {
    margin: 10px 0 12px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .st {
    padding: 8px 4px;
    background: #fff;
    border: 2px solid var(--line);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
  }
  .st.now {
    border-color: var(--ink);
    background: #e3f4ee;
    box-shadow: 2px 2px 0 var(--ink);
  }
  .st.future :global(svg) {
    opacity: 0.35;
    filter: grayscale(0.6);
  }
  .st b {
    font-size: 11px;
    font-weight: 900;
    line-height: 1.15;
  }
  .st small {
    font-size: 10px;
    font-weight: 800;
    color: var(--muted-2);
  }
</style>
