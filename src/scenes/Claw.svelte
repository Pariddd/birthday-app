<script lang="ts">
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import { vibrate } from '../lib/fx'
  import ArcadeHeader from '../components/ArcadeHeader.svelte'
  import Prize from '../components/Prize.svelte'
  import DoaCard from '../components/DoaCard.svelte'
  import Rekap from '../components/Rekap.svelte'
  import { KARTU_DOA } from '../doa'
  import Icon from '../components/Icon.svelte'

  const SLOTS: [number, number, number][] = [
    [140, 372, 28], [198, 378, 26], [254, 372, 28], [296, 380, 20],
    [168, 326, 26], [226, 328, 27], [278, 330, 22], [198, 284, 22],
  ]
  const COLORS = ['#F28AA5', '#9CCBF0', '#8ED3BE', '#C3B1F0', '#F6D58E', '#FFC9D9', '#B98863', '#9CCBF0']
  const MIN_X = 110
  const MAX_X = 300
  const RAIL_Y = 112
  const CHUTE_X = 70

  // Isi mesin: 8 foto dulu → setelah habis "diisi ulang" kartu doa → setelah habis: stok habis.
  const legendaryFoto = config.foto.findIndex((f) => (f as { legendary?: boolean }).legendary)
  const legendaryDoa = KARTU_DOA.findIndex((k) => k.rarity === 'legendary')
  const sisaFoto = $derived(config.foto.map((_, i) => i).filter((i) => !game.collected.includes(i)))
  const sisaDoa = $derived(KARTU_DOA.map((_, i) => i).filter((i) => !game.doa.includes(i)))
  const mode = $derived<'foto' | 'doa' | 'habis'>(sisaFoto.length ? 'foto' : sisaDoa.length ? 'doa' : 'habis')
  const remaining = $derived(mode === 'foto' ? sisaFoto : mode === 'doa' ? sisaDoa : [])
  const legendaryIdx = $derived(mode === 'foto' ? legendaryFoto : legendaryDoa)
  // legendary selalu keluar terakhir
  const queue = $derived([...remaining.filter((i) => i !== legendaryIdx), ...remaining.filter((i) => i === legendaryIdx)])

  const capsules = $derived(remaining.slice(0, SLOTS.length).map((photo, k) => ({ photo, slot: k, gold: photo === legendaryIdx })))
  const SIGN = { foto: 'CAPIT FOTO', doa: 'CAPIT DOA', habis: 'STOK HABIS' } as const

  const claw = $state({ x: 200, len: 40, open: 1 })
  let busy = $state(false)
  let attempts = $state(0)
  let bubble = $state('')
  let held = $state<{ slot: number; x: number; y: number; gold: boolean; color: string } | null>(null)
  let hiddenSlot = $state<number | null>(null)
  let prize = $state<{ kind: 'foto' | 'doa'; idx: number } | null>(null)
  let rekap = $state(false)

  function closePrize() {
    const wasFoto = prize?.kind === 'foto'
    prize = null
    // foto ke-8 baru saja didapat → tampilkan poster Rekap Kenangan
    if (wasFoto && game.collected.length === config.foto.length) rekap = true
  }

  function closeRekap() {
    rekap = false
    setTimeout(() => game.say('Mesinnya diisi ulang… sekarang isinya kartu doa!', 3600), 400)
  }
  let moveTimer: ReturnType<typeof setInterval> | undefined

  const headY = $derived(RAIL_Y + claw.len)
  const prongs = $derived.by(() => {
    const o = 8 + claw.open * 14
    const x = claw.x
    const y = headY + 12
    return `M${x - 8} ${y} L${x - o} ${y + 22} L${x - o + 8} ${y + 32} M${x + 8} ${y} L${x + o} ${y + 22} L${x + o - 8} ${y + 32}`
  })

  function startMove(dir: number) {
    if (busy) return
    stopMove()
    const step = () => (claw.x = Math.max(MIN_X, Math.min(MAX_X, claw.x + dir * 4)))
    step()
    moveTimer = setInterval(step, 16)
  }
  function stopMove() {
    clearInterval(moveTimer)
  }
  function keymove(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') claw.x = Math.max(MIN_X, claw.x - 12)
    if (e.key === 'ArrowRight') claw.x = Math.min(MAX_X, claw.x + 12)
  }

  function refill() {
    game.coins += 3
    game.save()
    sfx.coin()
    game.say('Mesinnya kasihan sama kamu. +3 koin!')
  }

  function grab() {
    if (busy || remaining.length === 0) return
    if (game.coins <= 0) return
    busy = true
    bubble = ''
    game.coins -= 1
    attempts += 1
    game.save()
    sfx.coin()

    // Hasil ditentukan dulu, animasi menyesuaikan. Pity: pasti dapat di percobaan ke-3.
    const win = attempts >= 3 || Math.random() < 0.4
    const photo = queue[0]
    const kind = mode as 'foto' | 'doa'
    // kapsul terdekat dari posisi capit
    let best = capsules[0]
    let bd = Infinity
    for (const c of capsules) {
      const d = Math.abs(SLOTS[c.slot][0] - claw.x) + (SLOTS[c.slot][1] - 260) * 0.2
      if (d < bd) {
        bd = d
        best = c
      }
    }
    const [sx, sy, sr] = SLOTS[best.slot]
    const depth = sy - sr - RAIL_Y - 44
    const tl = gsap.timeline({
      onComplete: () => {
        busy = false
      },
    })
    tl.to(claw, { x: sx, duration: 0.35, ease: 'power1.inOut' })
      .add(() => sfx.claw())
      .to(claw, { len: depth, duration: 1, ease: 'power1.in' })
      .to(claw, { open: 0, duration: 0.25 })
      .add(() => {
        hiddenSlot = best.slot
        held = { slot: best.slot, x: sx, y: sy, gold: best.gold, color: COLORS[best.slot % COLORS.length] }
      })

    if (win) {
      tl.add(() => sfx.claw())
        .to(claw, { len: 40, duration: 1, ease: 'power1.out', onUpdate: () => held && (held = { ...held, x: claw.x, y: headY + 44 }) })
        .to(claw, { x: CHUTE_X + 10, duration: 0.9, ease: 'power1.inOut', onUpdate: () => held && (held = { ...held, x: claw.x, y: headY + 44 }) })
        .to(claw, { open: 1, duration: 0.2 })
        .add(() => {
          sfx.tada()
          vibrate(50)
          held = null
          hiddenSlot = null
          attempts = 0
          if (kind === 'foto') game.collected = [...game.collected, photo]
          else game.doa = [...game.doa, photo]
          game.save()
          prize = { kind, idx: photo }
        })
        .to(claw, { x: 200, duration: 0.6 })
    } else {
      tl.add(() => sfx.claw())
        .to(claw, {
          len: depth * 0.45,
          duration: 0.7,
          ease: 'power1.out',
          onUpdate: () => held && (held = { ...held, x: claw.x, y: headY + 44 }),
        })
        .to(claw, { open: 0.6, duration: 0.1 })
        .add(() => {
          bubble = ['dikit lagi!', 'yaah, licin…', 'hampir!!'][attempts % 3]
          sfx.wrong()
          if (held) {
            const h = { y: held.y }
            gsap.to(h, {
              y: sy,
              duration: 0.45,
              ease: 'bounce.out',
              onUpdate: () => {
                if (held) held = { ...held, x: sx, y: h.y }
              },
              onComplete: () => {
                held = null
                hiddenSlot = null
              },
            })
          }
        })
        .to(claw, { len: 40, open: 1, duration: 0.8, ease: 'power1.inOut' })
    }
  }

  onDestroy(stopMove)
</script>

<svelte:window onkeydown={keymove} onpointerup={stopMove} />

<section class="scene arcade">
  <ArcadeHeader title="Claw Machine" coins />

  <div class="machine">
    <svg role="img" aria-label="Mesin capit. {remaining.length} kapsul {mode === 'doa' ? 'kartu doa' : 'foto'} tersisa." viewBox="0 0 350 510" fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="8" y="6" width="334" height="496" rx="26" fill={mode === 'doa' ? '#D9CCF5' : '#FFC9D9'} style="transition: fill .6s" />
      <rect x="70" y="20" width="210" height="44" rx="14" fill="#FFF4CC" />
      <text x="175" y="50" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="20" fill="#23408E" stroke="none" letter-spacing="2">{SIGN[mode]}</text>
      <circle cx="52" cy="42" r="6" fill="#F6D58E" /><circle cx="298" cy="42" r="6" fill="#F6D58E" />
      <rect x="30" y="80" width="290" height="330" rx="12" fill="#E8F4FF" />
      <path d="M52 96 L92 96 M48 112 L70 112 M270 380 L300 350 M286 392 L306 372" stroke="#FFFFFF" stroke-width="4" />
      <path d="M30 {RAIL_Y - 8} H320" stroke-width="2" />
      <rect x="38" y="302" width="64" height="100" rx="8" fill="#23408E" fill-opacity="0.12" stroke-dasharray="5 5" />
      <text x="70" y="358" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="20" fill="#23408E" stroke="none">ambil</text>

      {#each capsules as c (c.photo)}
        {#if hiddenSlot !== c.slot}
          {@const s = SLOTS[c.slot]}
          <g stroke-width="2.2">
            <circle cx={s[0]} cy={s[1]} r={s[2]} fill={c.gold ? '#FFF4CC' : '#FFFFFF'} />
            <path d="M{s[0] - s[2]} {s[1]} A{s[2]} {s[2]} 0 0 1 {s[0] + s[2]} {s[1]} Z" fill={c.gold ? '#F2B84B' : COLORS[c.slot % COLORS.length]} />
            {#if c.gold}<path d="M{s[0]} {s[1] - s[2] - 4} l0 -8 M{s[0] + s[2]} {s[1] - s[2] + 4} l6 -6 M{s[0] - s[2]} {s[1] - s[2] + 4} l-6 -6" stroke="#F2B84B" />{/if}
          </g>
        {/if}
      {/each}

      <rect x={claw.x - 22} y={RAIL_Y - 16} width="44" height="16" rx="5" fill="#9CCBF0" />
      <path d="M{claw.x} {RAIL_Y} V{headY}" stroke-width="2" />
      <rect x={claw.x - 12} y={headY - 2} width="24" height="14" rx="4" fill="#C3B1F0" />
      <path d={prongs} />
      {#if held}
        <g stroke-width="2.2">
          <circle cx={held.x} cy={held.y} r="24" fill={held.gold ? '#FFF4CC' : '#FFFFFF'} />
          <path d="M{held.x - 24} {held.y} A24 24 0 0 1 {held.x + 24} {held.y} Z" fill={held.gold ? '#F2B84B' : held.color} />
        </g>
      {/if}

      <rect x="30" y="424" width="290" height="62" rx="14" fill="#FFFFFF" />
      <rect x="152" y="440" width="46" height="8" rx="4" fill="#23408E" />
      <text x="175" y="472" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#23408E" stroke="none">masukkan 1 koin</text>
    </svg>
    {#if bubble}<span class="bubble hand">{bubble}</span>{/if}
  </div>

  {#if mode === 'habis'}
    <div class="note done">Stok habis. Datang lagi tahun depan ya 😌</div>
    <button class="btn" onclick={() => game.go('album')}>Lihat koleksimu di album</button>
  {:else}
    <div class="controls">
      <div class="dpad">
        <button class="ctl" aria-label="Geser kiri" disabled={busy} onpointerdown={() => startMove(-1)} onpointerup={stopMove} onpointerleave={stopMove}><Icon name="left" size={26} stroke={2.8} /></button>
        <button class="ctl" aria-label="Geser kanan" disabled={busy} onpointerdown={() => startMove(1)} onpointerup={stopMove} onpointerleave={stopMove}><Icon name="right" size={26} stroke={2.8} /></button>
      </div>
      {#if game.coins > 0}
        <button class="grab" onclick={grab} disabled={busy}>Capit!</button>
      {:else}
        <button class="grab refill" onclick={refill}>Koin habis…</button>
      {/if}
    </div>
    <div class="note">
      <span>{attempts > 0 ? `Percobaan ke-${attempts + 1}` : 'Geser capitnya, lalu tekan Capit!'}</span>
      <b>{mode === 'foto' ? `${game.collected.length}/${config.foto.length} foto` : `${game.doa.length}/${KARTU_DOA.length} doa`}</b>
    </div>
  {/if}

  {#if prize?.kind === 'foto'}
    <Prize index={prize.idx} onclose={closePrize} />
  {:else if prize?.kind === 'doa'}
    <DoaCard index={prize.idx} onclose={closePrize} />
  {/if}
  {#if rekap}
    <Rekap celebrate onclose={closeRekap} />
  {/if}
</section>

<style>
  .scene.arcade {
    padding-left: 20px;
    padding-right: 20px;
  }
  .machine {
    position: relative;
    flex: 1;
    min-height: 260px;
    display: flex;
    justify-content: center;
  }
  .machine svg {
    height: 100%;
    max-height: 56vh;
    width: auto;
    max-width: 100%;
    overflow: visible;
  }
  .bubble {
    position: absolute;
    top: 14%;
    right: 6%;
    padding: 6px 12px;
    border: 2px solid var(--ink);
    border-radius: 14px 14px 14px 4px;
    background: #fff;
    font-size: 22px;
    color: var(--pink-dark);
  }
  .controls {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dpad {
    display: flex;
    gap: 12px;
  }
  .ctl {
    width: 64px;
    height: 64px;
    border: 2.5px solid var(--ink);
    border-radius: 18px 14px 20px 15px;
    background: #fff;
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
    color: var(--ink);
  }
  .ctl:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .grab {
    width: 132px;
    height: 84px;
    border: 2.5px solid var(--ink);
    border-radius: 42px;
    background: var(--pink-dark);
    color: #fff;
    font-weight: 900;
    font-size: 22px;
    box-shadow: 0 6px 0 var(--ink);
    cursor: pointer;
  }
  .grab:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 var(--ink);
  }
  .grab:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .grab.refill {
    background: var(--butter);
    color: var(--ink);
    font-size: 17px;
  }
  .note {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border: 2px dashed var(--ink);
    border-radius: 14px;
    background: #fff;
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }
  .note b {
    color: var(--pink-dark);
  }
  .note.done {
    justify-content: center;
    text-align: center;
    margin-bottom: 12px;
  }
</style>
