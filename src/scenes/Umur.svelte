<script lang="ts">
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { draw } from '../lib/fx'
  import Icon from '../components/Icon.svelte'

  // Lahir 00:00 WIB (UTC+7)
  const lahir = Date.UTC(config.lahir.tahun, config.lahir.bulan - 1, config.lahir.tanggal) - 7 * 3600_000
  const kenal = config.kenalSejak ? Date.parse(config.kenalSejak + 'T00:00:00+07:00') : null

  let now = $state(Date.now())
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(t)
  })

  const diff = $derived(Math.max(0, now - lahir))
  const hari = $derived(Math.floor(diff / 86_400_000))
  const jam = $derived(Math.floor((diff % 86_400_000) / 3_600_000))
  const menit = $derived(Math.floor((diff % 3_600_000) / 60_000))
  const detik = $derived(Math.floor((diff % 60_000) / 1000))
  const umur = $derived.by(() => {
    const d = new Date(now + 7 * 3600_000) // waktu WIB
    let u = d.getUTCFullYear() - config.lahir.tahun
    const sebelumUltah = d.getUTCMonth() + 1 < config.lahir.bulan || (d.getUTCMonth() + 1 === config.lahir.bulan && d.getUTCDate() < config.lahir.tanggal)
    if (sebelumUltah) u--
    return u
  })
  const detak = $derived(Math.round((diff / 60_000) * 80 / 1_000_000)) // ±80 bpm, dalam juta
  const hariKenal = $derived(kenal ? Math.max(0, Math.floor((now - kenal) / 86_400_000)) : null)
  const fmt = (n: number) => n.toLocaleString('id-ID')
  const two = (n: number) => String(n).padStart(2, '0').split('')
</script>

<section class="scene">
  <p class="hand eyebrow">fakta penting hari ini:</p>
  <p class="lead">{config.nama} sudah hidup selama</p>

  <div class="days">
    <span class="num">{fmt(hari)}</span>
    <span class="hand unit">hari</span>
  </div>
  <svg class="underline" viewBox="0 0 250 18" fill="none" stroke="#E0557A" stroke-width="3" stroke-linecap="round" aria-hidden="true" use:draw={{ delay: 0.3 }}><path d="M2 10 C40 4 80 14 120 8 C160 3 200 14 248 6" /></svg>

  <div class="clock" aria-label="{jam} jam {menit} menit {detik} detik">
    {#each [{ v: jam, l: 'jam' }, { v: menit, l: 'menit' }, { v: detik, l: 'detik' }] as part, i (part.l)}
      {#if i > 0}<span class="colon" aria-hidden="true">:</span>{/if}
      <div class="unitbox">
        <div class="digits">
          {#each two(part.v) as d, j (j)}
            <div class="digit" class:live={part.l === 'detik'}>
              {#key d}<span in:fly={{ y: -14, duration: 220 }}>{d}</span>{/key}
            </div>
          {/each}
        </div>
        <span class="lbl">{part.l}</span>
      </div>
    {/each}
  </div>
  <p class="hand sub">…dan terus nambah, nih liat</p>

  <div class="facts">
    <div class="fact" style="background:#FFF4CC;transform:rotate(-2deg)">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="#F6D58E" stroke="#23408E" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" fill="none" /></svg>
      <b>{umur}×</b>
      <span>keliling matahari</span>
    </div>
    <div class="fact" style="background:#E3F4EE;transform:rotate(1.5deg)">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="#CFE6F7" stroke="#23408E" stroke-width="1.6" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      <b>±{fmt(hari)}</b>
      <span>kali bangun tidur (sebagian sambil ngomel)</span>
    </div>
    <div class="fact" style="background:#FFE3EA;transform:rotate(-1deg)">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#23408E" stroke-width="1.6" stroke-linejoin="round"><path d="M3 9h3l2-4 3 9 2-5h8" /></svg>
      <b>±{fmt(detak)} jt</b>
      <span>detak jantung</span>
    </div>
  </div>

  {#if hariKenal !== null}
    <div class="kenal">
      <span>…dan sudah <b>{fmt(hariKenal)} hari</b> kenal aku</span>
      <span class="hand">(kasihan juga ya)</span>
    </div>
  {/if}

  <div class="foot">
    <button class="btn" onclick={() => game.next()}>Lanjut <Icon name="next" /></button>
  </div>
</section>

<style>
  .eyebrow {
    font-size: 30px;
    color: var(--pink-dark);
  }
  .lead {
    font-size: 17px;
    font-weight: 700;
    color: var(--muted);
  }
  .days {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 6px;
  }
  .num {
    font-weight: 900;
    font-size: clamp(64px, 21vw, 84px);
    line-height: 1;
    letter-spacing: -2px;
  }
  .unit {
    font-size: 40px;
    color: var(--pink-dark);
  }
  .underline {
    width: 250px;
    max-width: 90%;
    margin-top: 2px;
  }
  .clock {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 18px;
  }
  .unitbox {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .digits {
    display: flex;
    gap: 4px;
  }
  .digit {
    width: 30px;
    height: 44px;
    border: 2px solid var(--ink);
    border-radius: 8px 6px 9px 7px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 24px;
    overflow: hidden;
  }
  .digit.live {
    background: #ffe3ea;
  }
  .colon {
    font-weight: 900;
    font-size: 26px;
    line-height: 44px;
  }
  .lbl {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .sub {
    font-size: 22px;
    font-weight: 500;
    color: var(--muted-2);
    margin-top: 8px;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: clamp(14px, 3vh, 28px);
  }
  .fact {
    border: 2px solid var(--ink);
    border-radius: 12px 8px 14px 9px;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 3px 3px 0 var(--ink);
  }
  .fact svg {
    width: 30px;
    height: 30px;
  }
  .fact b {
    font-weight: 900;
    font-size: 20px;
    line-height: 1;
  }
  .fact span {
    font-size: 12px;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text);
  }
  .kenal {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border: 2px dashed var(--ink);
    border-radius: 14px;
    background: #fff;
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  .kenal b {
    color: var(--pink-dark);
    font-weight: 900;
  }
  .kenal .hand {
    font-size: 22px;
    font-weight: 500;
    color: var(--muted-2);
  }
  .foot {
    margin-top: auto;
    padding-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
</style>
