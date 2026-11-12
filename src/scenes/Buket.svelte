<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import gsap from 'gsap'
  import { config } from '../config'
  import { game, reducedMotion } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import { burst, vibrate } from '../lib/fx'
  import { PESAN_BUNGA } from '../buket'
  import Icon from '../components/Icon.svelte'

  // Buket "Thumbelina": kubah bunga campuran yang padat, dibungkus kerucut kertas pink + kertas lilac, pita biru.
  // Di dongeng, Thumbelina lahir dari kuncup tulip — di sini yang lahir dari kuncup adalah surat untuk Dilla.
  type Key = keyof typeof PESAN_BUNGA
  type Kind = 'rose' | 'sun' | 'lily' | 'daisy' | 'hyd' | 'filler' | 'bud' | 'leaf'
  interface F {
    t: Kind
    x: number
    y: number
    r: number
    c?: string
    rot?: number
    key?: Key
  }

  // urutan = urutan gambar (belakang → depan)
  // Kubah bunga rapat (pusat ±150,160) — bunga besar & saling tumpang tindih supaya
  // kertas belakang hampir tidak kelihatan, seperti buket Thumbelina aslinya.
  const FLOWERS: F[] = [
    { t: 'bud', x: 186, y: 72, r: 16, rot: 14 },
    { t: 'bud', x: 212, y: 82, r: 13, rot: 28 },
    { t: 'bud', x: 96, y: 74, r: 12, rot: -20 },
    { t: 'leaf', x: 50, y: 130, r: 20, rot: -40 },
    { t: 'leaf', x: 252, y: 136, r: 20, rot: 40 },
    { t: 'leaf', x: 54, y: 214, r: 18, rot: -70 },
    { t: 'leaf', x: 250, y: 222, r: 18, rot: 70 },
    { t: 'leaf', x: 122, y: 70, r: 15, rot: -12 },
    { t: 'daisy', x: 82, y: 98, r: 13, c: '#F7B8CC', key: 'daisy' },
    { t: 'daisy', x: 108, y: 84, r: 12, c: '#F7B8CC', key: 'daisy' },
    { t: 'daisy', x: 234, y: 104, r: 13, c: '#F7B8CC', key: 'daisy' },
    { t: 'filler', x: 58, y: 174, r: 5.5 },
    { t: 'filler', x: 248, y: 200, r: 5.5 },
    { t: 'filler', x: 78, y: 232, r: 5 },
    { t: 'hyd', x: 240, y: 172, r: 26, key: 'hortensia' },
    { t: 'rose', x: 134, y: 102, r: 21, c: '#F5A35C', key: 'mawar' },
    { t: 'rose', x: 198, y: 108, r: 22, c: '#F7E3CF', key: 'mawar' },
    { t: 'rose', x: 236, y: 138, r: 19, c: '#D9475E', key: 'mawar' },
    { t: 'rose', x: 66, y: 148, r: 22, c: '#5D7FC2', key: 'mawar' },
    { t: 'daisy', x: 164, y: 92, r: 12, c: '#FFFFFF', key: 'daisy' },
    { t: 'sun', x: 106, y: 152, r: 37, key: 'matahari' },
    { t: 'rose', x: 64, y: 198, r: 17, c: '#D9475E', key: 'mawar' },
    { t: 'rose', x: 236, y: 212, r: 18, c: '#F7C6A8', key: 'mawar' },
    { t: 'rose', x: 100, y: 212, r: 20, c: '#F7E3CF', key: 'mawar' },
    { t: 'daisy', x: 216, y: 236, r: 13, c: '#FFFFFF', key: 'daisy' },
    { t: 'rose', x: 196, y: 222, r: 20, c: '#A9CDEB', key: 'mawar' },
    { t: 'rose', x: 148, y: 230, r: 23, c: '#D9475E', key: 'mawar' },
    { t: 'lily', x: 174, y: 160, r: 48, key: 'lili' },
  ]
  const NAMA: Record<Key, string> = { matahari: 'Bunga matahari', lili: 'Bunga lili', mawar: 'Mawar', daisy: 'Daisy', hortensia: 'Hortensia' }

  const ring = (n: number, off = 0) => Array.from({ length: n }, (_, i) => off + (360 / n) * i)
  const HYD = [
    [0, 0], [-10, -6], [10, -6], [-12, 6], [12, 6], [0, -12], [0, 12], [-6, 14], [8, -14],
  ]
  function petal(L: number, w: number) {
    return `M0 0 C${w} ${-L * 0.35} ${w * 0.7} ${-L * 0.82} 0 ${-L} C${-w * 0.7} ${-L * 0.82} ${-w} ${-L * 0.35} 0 0 Z`
  }
  function fern(x1: number, y1: number, x2: number, y2: number, n = 8) {
    let d = `M${x1} ${y1} Q${(x1 + x2) / 2 - 12} ${(y1 + y2) / 2} ${x2} ${y2}`
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1)
      const mx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2 - 12) + t * t * x2
      const my = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * ((y1 + y2) / 2) + t * t * y2
      const len = 11 * (1 - t * 0.6)
      d += ` M${mx} ${my} l${-len} ${-len * 0.45} M${mx} ${my} l${len * 0.8} ${-len * 0.7}`
    }
    return d
  }

  let phase = $state<'intro' | 'bouquet' | 'open'>(reducedMotion ? 'bouquet' : 'intro')
  let opening = false
  let svg = $state<SVGSVGElement>()!
  let wrap = $state<HTMLDivElement>()!

  function tapFlower(k: Key, el: EventTarget | null) {
    if (phase === 'intro') return
    sfx.tap()
    vibrate(10)
    game.say(PESAN_BUNGA[k], 3200)
    if (el && !reducedMotion) gsap.fromTo(el as Element, { scale: 1.15 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.35)', transformOrigin: '50% 50%' })
  }

  function openBud() {
    if (phase !== 'bouquet' || opening) return
    opening = true
    sfx.pop()
    vibrate(30)
    const d = reducedMotion ? 0.01 : 1
    gsap
      .timeline({
        onComplete: () => {
          phase = 'open'
          sfx.tada()
          const r = svg.getBoundingClientRect()
          burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.15) / innerHeight })
        },
      })
      .to('.bud-ring', { opacity: 0, duration: 0.2 * d })
      .to('.petal-l', { rotation: -50, svgOrigin: '150 100', duration: 0.9 * d, ease: 'back.out(1.6)' }, 0.1)
      .to('.petal-r', { rotation: 50, svgOrigin: '150 100', duration: 0.9 * d, ease: 'back.out(1.6)' }, 0.1)
      .to('.petal-f', { scaleY: 0.28, svgOrigin: '150 100', duration: 0.7 * d, ease: 'power2.out' }, 0.15)
      .to('.bud-glow', { attr: { r: 44 }, opacity: 1, duration: 0.8 * d, ease: 'power2.out' }, 0.3)
      .fromTo('.tiny-letter', { scale: 0.15, opacity: 0, svgOrigin: '150 74' }, { scale: 1.25, opacity: 1, y: -44, duration: 1 * d, ease: 'back.out(1.8)' }, 0.55)
  }

  onMount(() => {
    if (reducedMotion) return
    const t = setTimeout(() => {
      phase = 'bouquet'
      requestAnimationFrame(() => {
        gsap.from(wrap, { y: 160, opacity: 0, duration: 0.8, ease: 'back.out(1.3)', clearProps: 'transform,opacity' })
        gsap.from(svg.querySelectorAll('.pop'), { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.05, delay: 0.45, transformOrigin: '50% 50%' })
      })
    }, 1400)
    return () => clearTimeout(t)
  })
</script>

<section class="scene">
  <!-- Tinggi area judul dikunci & pergantian teks hanya memudar (tanpa geser),
       supaya judul/nama tidak "loncat" saat fase berganti. -->
  <div class="head">
    {#if phase === 'intro'}
      <h1 class="hand" in:fade={{ duration: 300 }}>Eh, masih ada<br />satu lagi…</h1>
    {:else if phase === 'bouquet'}
      <h1 class="hand" in:fade={{ duration: 300 }}>Buket Thumbelina<br /><span class="name">buat {config.nama}</span></h1>
      <p in:fade={{ duration: 300, delay: 250 }}>Ada yang sembunyi di kuncup tulip paling atas… ketuk deh.</p>
    {:else}
      <h1 class="hand" in:fade={{ duration: 300 }}>Ada surat mungil<br /><span class="name">di dalamnya!</span></h1>
      <p in:fade={{ duration: 300, delay: 250 }}>Kayak Thumbelina, tapi versi surat.</p>
    {/if}
  </div>

  <div class="stagebox">
    {#if phase !== 'intro'}
      <div class="bouquet" bind:this={wrap}>
        <svg bind:this={svg} viewBox="6 22 288 392" fill="none" stroke="#23408E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" role="group" aria-label="Buket bunga warna-warni berbungkus kertas pink, dengan kuncup tulip di puncaknya">
          <defs>
            <radialGradient id="budGlow">
              <stop offset="0" stop-color="#FFF3C4" stop-opacity="1" />
              <stop offset="0.5" stop-color="#F6D58E" stop-opacity="0.5" />
              <stop offset="1" stop-color="#F6D58E" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- kertas belakang lilac: kipas simetris (cermin di x=150). Sudutnya lebih lebar dari
               kerucut pink lalu menyempit ke ujung yang SAMA, jadi terlihat sebagai lapisan
               kertas yang rapi kiri-kanan, bukan garis ganda yang meleset. -->
          <path d="M12 214 C18 140 74 78 150 72 C226 78 282 140 288 214 L150 404 Z" fill="#ECE4FF" stroke-width="2.4" />
          <path d="M36 206 C46 152 94 104 150 96 M264 206 C254 152 206 104 150 96" stroke-width="1.4" stroke-opacity="0.4" />
          <path d="M24 226 L138 392 M276 226 L162 392" stroke-width="1.3" stroke-opacity="0.35" />

          <!-- pakis & tangkai kuncup -->
          <g class="pop" stroke="#3A8F7D" stroke-width="1.8">
            <path d={fern(96, 180, 54, 84, 9)} />
            <path d={fern(186, 150, 214, 56, 8)} />
          </g>
          <path d="M150 100 L150 230" stroke="#3A8F7D" stroke-width="2.2" />

          <!-- bunga -->
          {#each FLOWERS as f, i (i)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <g
              class="pop"
              class:tap={!!f.key}
              role={f.key ? 'button' : undefined}
              tabindex={f.key ? 0 : undefined}
              aria-label={f.key ? NAMA[f.key] : undefined}
              onclick={(e) => f.key && tapFlower(f.key, e.currentTarget)}
              onkeydown={(e) => f.key && e.key === 'Enter' && tapFlower(f.key, e.currentTarget)}
            >
              {#if f.t === 'rose'}
                <circle cx={f.x} cy={f.y} r={f.r} fill={f.c} />
                <path d="M{f.x - f.r * 0.82} {f.y + f.r * 0.12} Q{f.x} {f.y + f.r * 1.05} {f.x + f.r * 0.82} {f.y + f.r * 0.12}" stroke-width="1.5" />
                <path d="M{f.x - f.r * 0.78} {f.y - f.r * 0.12} Q{f.x - f.r * 0.3} {f.y - f.r * 0.98} {f.x + f.r * 0.4} {f.y - f.r * 0.72}" stroke-width="1.5" />
                <path d="M{f.x} {f.y} m{-f.r * 0.45} 0 a{f.r * 0.45} {f.r * 0.45} 0 1 1 {f.r * 0.45} {f.r * 0.45} a{f.r * 0.28} {f.r * 0.28} 0 1 1 {-f.r * 0.28} {-f.r * 0.28} a{f.r * 0.12} {f.r * 0.12} 0 1 1 {f.r * 0.12} {f.r * 0.12}" stroke-width="1.6" />
              {:else if f.t === 'sun'}
                {#each ring(14) as a (a)}<ellipse cx={f.x} cy={f.y - f.r * 0.64} rx={f.r * 0.2} ry={f.r * 0.42} fill="#F6C342" transform="rotate({a} {f.x} {f.y})" />{/each}
                <circle cx={f.x} cy={f.y} r={f.r * 0.42} fill="#8A5A3B" />
                {#each [[-4, -3], [3, -4], [-1, 3], [5, 2], [-5, 4]] as [dx, dy] (dx + ',' + dy)}<circle cx={f.x + dx} cy={f.y + dy} r="1.3" fill="#23408E" stroke="none" />{/each}
              {:else if f.t === 'lily'}
                {#each ring(6, 30) as a (a)}
                  <g transform="translate({f.x} {f.y}) rotate({a})">
                    <path d={petal(f.r, f.r * 0.36)} fill="#F49AB4" />
                    <path d="M0 -4 L0 {-f.r * 0.85}" stroke="#C93D66" stroke-width="1.4" />
                    <circle cx="-3" cy={-f.r * 0.35} r="1.1" fill="#C93D66" stroke="none" />
                    <circle cx="3" cy={-f.r * 0.5} r="1.1" fill="#C93D66" stroke="none" />
                    <path d="M{-f.r * 0.12} {-f.r * 0.75} Q0 {-f.r * 0.98} {f.r * 0.12} {-f.r * 0.75}" stroke="#FFFFFF" stroke-width="1.4" />
                  </g>
                {/each}
                {#each ring(6, 0) as a (a)}
                  <g transform="translate({f.x} {f.y}) rotate({a})"><path d="M0 0 L0 -13" stroke-width="1.3" /><ellipse cx="0" cy="-14" rx="2" ry="3.2" fill="#F5A35C" stroke-width="1" /></g>
                {/each}
                <circle cx={f.x} cy={f.y} r="4" fill="#CDEFE3" stroke-width="1.4" />
              {:else if f.t === 'daisy'}
                {#each ring(10) as a (a)}<ellipse cx={f.x} cy={f.y - f.r * 0.6} rx={f.r * 0.26} ry={f.r * 0.46} fill={f.c} transform="rotate({a} {f.x} {f.y})" stroke-width="1.5" />{/each}
                <circle cx={f.x} cy={f.y} r={f.r * 0.32} fill="#F6C342" stroke-width="1.5" />
              {:else if f.t === 'hyd'}
                {#each HYD as [dx, dy] (dx + ',' + dy)}
                  {@const s = f.r / 20}
                  <circle cx={f.x + dx * s} cy={f.y + dy * s} r={6 * s} fill="#BFDDF5" stroke-width="1.4" />
                  <path d="M{f.x + dx * s - 2} {f.y + dy * s} h4 M{f.x + dx * s} {f.y + dy * s - 2} v4" stroke-width="1.1" />
                {/each}
              {:else if f.t === 'leaf'}
                <g transform="translate({f.x} {f.y}) rotate({f.rot})">
                  <path d="M0 {f.r} C{-f.r * 0.6} {f.r * 0.3} {-f.r * 0.5} {-f.r * 0.6} 0 {-f.r} C{f.r * 0.5} {-f.r * 0.6} {f.r * 0.6} {f.r * 0.3} 0 {f.r} Z" fill="#7FC4A0" />
                  <path d="M0 {f.r * 0.9} L0 {-f.r * 0.8}" stroke-width="1.2" stroke-opacity="0.6" />
                </g>
              {:else if f.t === 'filler'}
                <path d="M{f.x} {f.y} l-6 12 M{f.x + 8} {f.y + 4} l-4 12 M{f.x - 7} {f.y + 6} l2 12" stroke="#3A8F7D" stroke-width="1.4" />
                <circle cx={f.x} cy={f.y} r={f.r} fill="#F2C94C" stroke-width="1.4" />
                <circle cx={f.x + 8} cy={f.y + 4} r={f.r * 0.85} fill="#F2C94C" stroke-width="1.4" />
                <circle cx={f.x - 7} cy={f.y + 6} r={f.r * 0.8} fill="#F2C94C" stroke-width="1.4" />
              {:else if f.t === 'bud'}
                <path d="M{f.x} {f.y + f.r} L{f.x - 6} {f.y + f.r + 34}" stroke="#3A8F7D" stroke-width="2" />
                <ellipse cx={f.x} cy={f.y} rx={f.r * 0.38} ry={f.r} fill="#A8D5A2" transform="rotate({f.rot} {f.x} {f.y})" />
                <path d="M{f.x} {f.y - f.r * 0.8} L{f.x} {f.y + f.r * 0.8}" stroke-width="1.1" stroke-opacity="0.5" transform="rotate({f.rot} {f.x} {f.y})" />
              {/if}
            </g>
          {/each}

          <!-- kerucut kertas depan pink (bentuk desain awal), menutupi pangkal bunga -->
          <path d="M36 228 C80 264 220 264 264 228 L150 404 Z" fill="#FBD3DE" stroke-width="2.4" />
          <path d="M86 254 L144 386 M214 254 L156 386 M150 262 L150 396" stroke-width="1.3" stroke-opacity="0.45" />
          <!-- arsiran kiri & kanan dicerminkan (x → 300 − x) supaya seimbang -->
          <path d="M44 240 L66 226 M48 262 L92 236 M58 286 L112 246 M70 310 L120 266" stroke="#E0557A" stroke-width="1.3" stroke-opacity="0.45" />
          <path d="M256 240 L234 226 M252 262 L208 236 M242 286 L188 246 M230 310 L180 266" stroke="#E0557A" stroke-width="1.3" stroke-opacity="0.45" />
          <path d="M36 228 C80 264 220 264 264 228" stroke="#E0557A" stroke-width="1.6" stroke-dasharray="4 5" />

          <!-- pita biru -->
          <g fill="#9CCBF0">
            <path d="M150 324 C118 300 100 328 128 338 C140 342 146 332 150 324 Z" />
            <path d="M150 324 C182 300 200 328 172 338 C160 342 154 332 150 324 Z" />
            <path d="M144 328 L128 372 M156 328 L174 370" fill="none" />
            <circle cx="150" cy="326" r="7" />
          </g>

          <!-- kuncup tulip (Thumbelina) di puncak -->
          <circle class="bud-glow" cx="150" cy="74" r="0" fill="url(#budGlow)" stroke="none" opacity="0" />
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="tiny-letter" opacity="0" role="button" tabindex={phase === 'open' ? 0 : -1} aria-label="Buka surat" style:cursor={phase === 'open' ? 'pointer' : 'default'} onclick={() => phase === 'open' && game.next()} onkeydown={(e) => e.key === 'Enter' && phase === 'open' && game.next()}>
            <rect x="136" y="64" width="28" height="20" rx="2" fill="#FFFFFF" stroke-width="2" />
            <path d="M136 65 L150 76 L164 65" stroke-width="1.6" />
            <path d="M146 74 C146 71 150 71 150 73 C150 71 154 71 154 74 C154 77 150 79 150 79 C150 79 146 77 146 74 Z" fill="#E0557A" stroke-width="1" />
          </g>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="bud" role="button" tabindex="0" aria-label="Kuncup tulip. Ketuk untuk membuka." onclick={openBud} onkeydown={(e) => e.key === 'Enter' && openBud()}>
            <circle class="bud-ring" cx="150" cy="70" r="38" stroke="#C93D66" stroke-width="2" stroke-dasharray="5 6" />
            <path class="petal-l" d="M150 100 C126 88 124 52 140 40 C146 54 150 76 150 100 Z" fill="#F7A6BC" />
            <path class="petal-r" d="M150 100 C174 88 176 52 160 40 C154 54 150 76 150 100 Z" fill="#F7A6BC" />
            <path class="petal-f" d="M150 102 C132 88 134 54 150 36 C166 54 168 88 150 102 Z" fill="#FFC9D9" />
            <path class="petal-f" d="M150 48 C146 64 146 82 150 96" stroke-width="1.3" stroke-opacity="0.5" />
          </g>
        </svg>
      </div>
    {/if}
  </div>

  <!-- Kelopak berguguran di lapisan sendiri yang memotong isinya (overflow: hidden).
       Dulu kelopak ada di dalam buket dan jatuh melewati bawah layar → browser menganggap
       kontennya memanjang → scrollbar muncul-hilang & tata letak ikut melebar-menyempit. -->
  {#if phase !== 'intro' && !reducedMotion}
    <div class="petals" aria-hidden="true">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}
        <span class="fall" style="left:{12 + i * 14}%; animation-delay:{i * 1.3}s; animation-duration:{6 + (i % 3)}s">
          <svg viewBox="0 0 12 16" width="12" height="16"><path d="M6 1 C11 5 11 12 6 15 C1 12 1 5 6 1 Z" fill={['#F49AB4', '#C3B1F0', '#F6C342', '#F7B8CC'][i % 4]} stroke="#23408E" stroke-width="1" /></svg>
        </span>
      {/each}
    </div>
  {/if}

  <div class="foot">
    {#if phase === 'bouquet'}
      <p class="hint hand" in:fade={{ duration: 300, delay: 1200 }}>psst… bunga lainnya juga bisa diketuk</p>
    {:else if phase === 'open'}
      <button class="btn pink wide" in:fly={{ y: 16, duration: 400, delay: 300 }} onclick={() => game.next()}>
        Baca suratnya <Icon name="next" />
      </button>
    {/if}
  </div>
</section>

<style>
  /* Isi scene ini selalu muat satu layar (judul & tombol tetap, buket menyesuaikan),
     jadi scroll dimatikan: animasi masuk buket tidak boleh memunculkan scrollbar. */
  .scene {
    overflow: hidden;
  }
  .head {
    min-height: 136px;
    flex-shrink: 0;
  }
  h1 {
    font-size: clamp(34px, 10vw, 42px);
    line-height: 1.02;
  }
  .name {
    color: var(--pink-dark);
  }
  .head p {
    margin-top: 8px;
    font-size: 15px;
    line-height: 1.45;
    color: var(--muted);
  }
  .stagebox {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -16px;
  }
  .bouquet {
    position: relative;
    height: 100%;
    max-height: 560px;
    aspect-ratio: 288 / 392;
    max-width: 100%;
  }
  .bouquet svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .tap,
  .bud {
    cursor: pointer;
    outline: none;
  }
  .tap:focus-visible,
  .bud:focus-visible {
    filter: drop-shadow(0 0 4px #c93d66);
  }
  .bud-ring {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 1.4s ease-in-out infinite;
  }
  /* Lapisan kelopak: seukuran scene, isinya dipotong supaya tidak menambah area scroll */
  .petals {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 1;
  }
  .fall {
    position: absolute;
    top: -4%;
    pointer-events: none;
    animation-name: fall;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    opacity: 0;
  }
  @keyframes fall {
    0% {
      transform: translate(0, 0) rotate(0);
      opacity: 0;
    }
    10% {
      opacity: 0.9;
    }
    50% {
      transform: translate(18px, 52vh) rotate(160deg);
    }
    90% {
      opacity: 0.9;
    }
    100% {
      transform: translate(-10px, 104vh) rotate(320deg);
      opacity: 0;
    }
  }
  .foot {
    min-height: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hint {
    font-size: 22px;
    font-weight: 500;
    color: var(--muted-2);
    text-align: center;
  }
  .wide {
    width: 100%;
  }
</style>
