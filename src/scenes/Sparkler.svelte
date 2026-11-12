<script lang="ts">
  import { onMount } from 'svelte'
  import gsap from 'gsap'
  import { game, reducedMotion } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import Cake from '../components/Cake.svelte'
  import Icon from '../components/Icon.svelte'

  // Jalur tengah angka "21" (koordinat viewBox). 13 titik untuk "2", 7 titik untuk "1".
  const PTS: [number, number][] = [
    [110, 300], [128, 276], [158, 264], [190, 272], [208, 298], [202, 330], [182, 358], [156, 386], [130, 414], [112, 438], [146, 440], [180, 440], [214, 440],
    [256, 300], [280, 272], [280, 306], [280, 340], [280, 374], [280, 408], [280, 440],
  ]
  const SPLIT = 13
  const HIT = 30

  let idx = $state(0)
  let tip = $state<[number, number]>([PTS[0][0] - 2, PTS[0][1] + 40])
  let holding = $state(false)
  let done = $state(false)
  let showHelp = $state(false)

  let section: HTMLElement
  let svg: SVGSVGElement
  let canvas: HTMLCanvasElement
  let digits: SVGGElement

  const pathOf = (pts: [number, number][]) => (pts.length ? 'M' + pts.map((p) => p.join(' ')).join(' L') : '')
  const traced2 = $derived(pathOf(PTS.slice(0, Math.min(idx, SPLIT))))
  const traced1 = $derived(idx > SPLIT ? pathOf(PTS.slice(SPLIT, idx)) : '')
  const stick = $derived(`M${tip[0] + 2} ${tip[1] + 6} L${tip[0] + 40} ${tip[1] + 92}`)

  function toSvg(e: PointerEvent): [number, number] {
    const pt = svg.createSVGPoint()
    // sentuhan: ujung sparkler 56px di atas jari supaya tidak tertutup jempol
    pt.x = e.clientX
    pt.y = e.clientY - (e.pointerType === 'touch' ? 56 : 0)
    const m = svg.getScreenCTM()
    if (!m) return tip
    const p = pt.matrixTransform(m.inverse())
    return [p.x, p.y]
  }

  function move(e: PointerEvent) {
    if (done || (!holding && e.pointerType !== 'mouse')) return
    tip = toSvg(e)
    if (!holding) return
    const target = PTS[idx]
    if (Math.hypot(tip[0] - target[0], tip[1] - target[1]) < HIT) {
      idx++
      sfx.dot(idx)
      vibrate(8)
      if (idx === PTS.length) finish()
    }
  }

  function down(e: PointerEvent) {
    if (done) return
    if ((e.target as HTMLElement).closest('button')) return
    holding = true
    section.setPointerCapture?.(e.pointerId)
    move(e)
  }
  function up() {
    holding = false
  }

  function finish() {
    done = true
    holding = false
    sfx.tada()
    const r = svg.getBoundingClientRect()
    burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight })
    gsap
      .timeline({ onComplete: () => game.next() })
      .to(digits, { scale: 1.08, transformOrigin: '50% 50%', duration: 0.25, yoyo: true, repeat: 1 })
      .to(digits, { y: 260, scale: 0.35, opacity: 0, duration: 0.9, ease: 'power2.in' }, '+=0.4')
      .to('.slot-fill', { opacity: 1, duration: 0.3, stagger: 0.1 }, '-=0.2')
      .to({}, { duration: 0.6 })
  }

  // Partikel percikan di canvas (dibatasi supaya tetap ringan di HP)
  onMount(() => {
    const ctx = canvas.getContext('2d')!
    const MAX = reducedMotion ? 30 : 130
    type P = { x: number; y: number; vx: number; vy: number; life: number; c: string }
    const parts: P[] = []
    const COLS = ['#F2B84B', '#E0557A', '#23408E', '#F6D58E']
    let raf = 0
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = section.clientWidth * dpr
      canvas.height = section.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(section)
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!done) {
        const m = svg.getScreenCTM()
        const sr = section.getBoundingClientRect()
        if (m) {
          const pt = svg.createSVGPoint()
          pt.x = tip[0]
          pt.y = tip[1]
          const s = pt.matrixTransform(m)
          const x = s.x - sr.left
          const y = s.y - sr.top + section.scrollTop
          const n = holding ? 4 : 1
          for (let i = 0; i < n && parts.length < MAX; i++) {
            const a = Math.random() * Math.PI * 2
            const v = 1.2 + Math.random() * (holding ? 3.2 : 1.6)
            parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: COLS[(Math.random() * COLS.length) | 0] })
          }
        }
      }
      ctx.lineCap = 'round'
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06
        p.life -= 0.035
        if (p.life <= 0) {
          parts.splice(i, 1)
          continue
        }
        ctx.strokeStyle = p.c
        ctx.globalAlpha = p.life
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  })
</script>

<section
  class="scene"
  bind:this={section}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  <div class="head">
    <div>
      <h1 class="hand">Tulis umurmu pakai kembang api</h1>
      <p>Tahan, lalu ikutin titik yang kedip.</p>
    </div>
  </div>
  <button class="icon-btn help" aria-label="Cara main" onclick={() => (showHelp = !showHelp)}><Icon name="info" /></button>
  {#if showHelp}
    <div class="help-pop">Sentuh layar dan tahan, lalu geser pelan ke titik pink yang berkedip. Lanjut terus sampai angkanya jadi.</div>
  {/if}

  <svg bind:this={svg} class="board" viewBox="70 236 250 236" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Titik-titik membentuk angka 21. {idx} dari {PTS.length} titik sudah dilewati.">
    <g bind:this={digits}>
      {#if traced2}
        <path d={traced2} stroke="#F6D58E" stroke-width="14" stroke-opacity="0.75" />
        <path d={traced2} stroke="#E0557A" stroke-width="3.5" />
      {/if}
      {#if traced1}
        <path d={traced1} stroke="#F6D58E" stroke-width="14" stroke-opacity="0.75" />
        <path d={traced1} stroke="#E0557A" stroke-width="3.5" />
      {/if}
      {#each PTS as p, i (i)}
        {#if i < idx}
          <circle cx={p[0]} cy={p[1]} r="6" fill="#F6D58E" stroke="#23408E" stroke-width="2" />
        {:else if i === idx}
          <circle class="next-ring" cx={p[0]} cy={p[1]} r="16" stroke="#C93D66" stroke-width="2.2" stroke-dasharray="4 4" />
          <circle cx={p[0]} cy={p[1]} r="7" fill="#C93D66" />
        {:else}
          <circle cx={p[0]} cy={p[1]} r="6" fill="#FFFFFF" stroke="#9AA6C8" stroke-width="2" />
        {/if}
      {/each}
    </g>
    {#if !done}
      <circle cx={tip[0]} cy={tip[1]} r="22" fill="#FFF0B3" fill-opacity="0.8" />
      <path d={stick} stroke="#23408E" stroke-width="8" />
      <path d={stick} stroke="#B98863" stroke-width="4" />
      <circle cx={tip[0]} cy={tip[1]} r="5" fill="#FFFFFF" stroke="#23408E" stroke-width="2" />
    {/if}
  </svg>

  <div class="cake">
    <Cake colors={game.cake} viewBox="0 30 300 230" label="Kue yang kamu warnai, menunggu lilin">
      <svg overflow="visible">
        <g stroke="#C93D66" stroke-width="2" stroke-dasharray="5 5" fill="none">
          <rect x="110" y="40" width="40" height="64" rx="9" />
          <rect x="162" y="40" width="32" height="64" rx="9" />
        </g>
        <text class="slot-fill" x="130" y="100" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="62" fill="#FBD3DE" stroke="#23408E" stroke-width="2.4" paint-order="stroke" opacity="0">2</text>
        <text class="slot-fill" x="178" y="100" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="62" fill="#CFE6F7" stroke="#23408E" stroke-width="2.4" paint-order="stroke" opacity="0">1</text>
      </svg>
    </Cake>
  </div>

  <div class="progress">
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={PTS.length} aria-valuenow={idx} aria-label="Progres titik"><div style="width:{(idx / PTS.length) * 100}%"></div></div>
    <span>{idx}/{PTS.length}</span>
  </div>

  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</section>

<style>
  .scene {
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }
  .head {
    padding-right: 48px;
  }
  h1 {
    font-size: clamp(34px, 10vw, 40px);
    line-height: 1;
  }
  .head p {
    margin-top: 6px;
    font-size: 15px;
    color: var(--muted);
  }
  .help {
    position: absolute;
    right: 18px;
    top: calc(76px + var(--safe-top));
  }
  .help-pop {
    position: absolute;
    right: 18px;
    left: 60px;
    top: calc(128px + var(--safe-top));
    z-index: 5;
    padding: 12px 14px;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text);
  }
  .board {
    flex: 1;
    width: 100%;
    min-height: 220px;
    margin-left: -12px;
    overflow: visible;
  }
  .next-ring {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 1s ease-in-out infinite;
  }
  .cake {
    width: min(230px, 30vh);
    align-self: center;
    margin-left: -20px;
  }
  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 900;
  }
  .bar {
    width: 160px;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: #f28aa5;
    transition: width 0.2s;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
