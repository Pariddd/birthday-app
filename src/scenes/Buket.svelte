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

  // Buket "Thumbelina": taman peri warna-warni. Di dongeng, Thumbelina lahir dari kuncup tulip
  // yang mekar — di sini, yang muncul dari kuncup adalah surat mungil untuk Dilla.
  type Flower = keyof typeof PESAN_BUNGA
  let phase = $state<'intro' | 'bouquet' | 'open'>(reducedMotion ? 'bouquet' : 'intro')
  let opening = false
  let svg = $state<SVGSVGElement>()!
  let wrap = $state<HTMLDivElement>()!

  // kelopak bunga dihitung sekali: [sudut, ...]
  const ring = (n: number) => Array.from({ length: n }, (_, i) => (360 / n) * i)

  function tapFlower(f: Flower, el: EventTarget | null) {
    if (phase === 'intro') return
    sfx.tap()
    vibrate(10)
    game.say(PESAN_BUNGA[f], 3200)
    if (el && !reducedMotion) gsap.fromTo(el as Element, { scale: 1.18 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.35)', transformOrigin: '50% 50%' })
  }

  function openBud() {
    if (phase !== 'bouquet' || opening) return
    opening = true
    sfx.pop()
    vibrate(30)
    const tl = gsap.timeline({
      onComplete: () => {
        phase = 'open'
        sfx.tada()
        const r = svg.getBoundingClientRect()
        burst({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.18) / innerHeight })
      },
    })
    const d = reducedMotion ? 0.01 : 1
    tl.to('.bud-ring', { opacity: 0, duration: 0.2 * d })
      .to('.petal-l', { rotation: -48, svgOrigin: '150 122', duration: 0.9 * d, ease: 'back.out(1.6)' }, 0.1)
      .to('.petal-r', { rotation: 48, svgOrigin: '150 122', duration: 0.9 * d, ease: 'back.out(1.6)' }, 0.1)
      .to('.petal-f', { scaleY: 0.28, svgOrigin: '150 122', duration: 0.7 * d, ease: 'power2.out' }, 0.15)
      .to('.bud-glow', { attr: { r: 46 }, opacity: 1, duration: 0.8 * d, ease: 'power2.out' }, 0.3)
      .fromTo('.tiny-letter', { scale: 0.15, opacity: 0, svgOrigin: '150 96' }, { scale: 1.25, opacity: 1, y: -52, duration: 1 * d, ease: 'back.out(1.8)' }, 0.55)
  }

  onMount(() => {
    if (reducedMotion) return
    const t = setTimeout(() => {
      phase = 'bouquet'
      requestAnimationFrame(() => {
        gsap.from(wrap, { y: 160, opacity: 0, duration: 0.8, ease: 'back.out(1.3)', clearProps: 'transform,opacity' })
        gsap.from(svg.querySelectorAll('.pop'), { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2.4)', stagger: 0.09, delay: 0.45, transformOrigin: '50% 50%' })
      })
    }, 1400)
    return () => clearTimeout(t)
  })
</script>

<section class="scene">
  <div class="head">
    {#if phase === 'intro'}
      <h1 class="hand" in:fade={{ duration: 400 }}>Eh, masih ada satu lagi…</h1>
    {:else if phase === 'bouquet'}
      <h1 class="hand" in:fly={{ y: 12, duration: 400 }}>Buket Thumbelina buat {config.nama}</h1>
      <p in:fade={{ duration: 400, delay: 200 }}>Ada yang sembunyi di kuncup tulip tengah… ketuk deh.</p>
    {:else}
      <h1 class="hand" in:fly={{ y: 12, duration: 400 }}>Ada surat mungil di dalamnya!</h1>
      <p in:fade={{ duration: 400, delay: 200 }}>Kayak Thumbelina, tapi versi surat.</p>
    {/if}
  </div>

  <div class="stagebox">
    {#if phase !== 'intro'}
      <div class="bouquet" bind:this={wrap}>
        <svg bind:this={svg} viewBox="20 30 260 370" fill="none" stroke="#23408E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" role="group" aria-label="Buket bunga warna-warni dengan kuncup tulip di tengah">
          <defs>
            <radialGradient id="budGlow">
              <stop offset="0" stop-color="#FFF3C4" stop-opacity="1" />
              <stop offset="0.5" stop-color="#F6D58E" stop-opacity="0.5" />
              <stop offset="1" stop-color="#F6D58E" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- kertas belakang -->
          <path d="M42 160 C70 118 110 104 150 104 C190 104 230 118 258 160 L150 380 Z" fill="#ECE4FF" />
          <path d="M60 158 C90 128 120 120 150 120 M240 158 C210 128 180 120 150 120" stroke-width="1.4" stroke-opacity="0.4" />

          <!-- tangkai -->
          <g stroke="#3A8F7D" stroke-width="2.2">
            <path d="M92 152 L148 300 M208 150 L152 300 M112 206 L148 300 M192 206 L152 300 M150 176 L150 300 M68 200 L146 300 M232 198 L154 300 M150 122 L150 300" />
          </g>

          <!-- daun -->
          <g class="pop" fill="#CDEFE3">
            <path d="M70 236 C76 216 98 210 110 222 C98 236 82 240 70 236 Z" />
            <path d="M230 236 C224 216 202 210 190 222 C202 236 218 240 230 236 Z" />
            <path d="M124 150 C120 132 132 118 146 122 C144 138 136 148 124 150 Z" />
            <path d="M176 150 C180 132 168 118 154 122 C156 138 164 148 176 150 Z" />
          </g>

          <!-- baby's breath -->
          <g class="pop" fill="#FFFFFF" stroke-width="1.6">
            <circle cx="62" cy="122" r="3.5" /><circle cx="72" cy="112" r="3" /><circle cx="56" cy="108" r="2.6" /><circle cx="74" cy="126" r="2.4" />
            <circle cx="238" cy="118" r="3.5" /><circle cx="248" cy="106" r="3" /><circle cx="228" cy="104" r="2.6" /><circle cx="226" cy="124" r="2.4" />
            <circle cx="112" cy="96" r="3" /><circle cx="122" cy="86" r="2.6" /><circle cx="188" cy="92" r="3" /><circle cx="178" cy="82" r="2.6" />
          </g>

          <!-- bunga matahari -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="pop flower" role="button" tabindex="0" aria-label="Bunga matahari" onclick={(e) => tapFlower('matahari', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && tapFlower('matahari', e.currentTarget)}>
            {#each ring(12) as a (a)}<ellipse cx="92" cy="132" rx="6" ry="13" fill="#F6D58E" transform="rotate({a} 92 150)" />{/each}
            <circle cx="92" cy="150" r="12" fill="#B98863" />
            <circle cx="88" cy="147" r="1.3" fill="#23408E" stroke="none" /><circle cx="95" cy="152" r="1.3" fill="#23408E" stroke="none" /><circle cx="90" cy="155" r="1.3" fill="#23408E" stroke="none" />
          </g>

          <!-- gerbera -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="pop flower" role="button" tabindex="0" aria-label="Bunga gerbera" onclick={(e) => tapFlower('gerbera', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && tapFlower('gerbera', e.currentTarget)}>
            {#each ring(16) as a (a)}<ellipse cx="208" cy="132" rx="4" ry="13" fill="#F28AA5" transform="rotate({a} 208 148)" />{/each}
            <circle cx="208" cy="148" r="9" fill="#F6D58E" />
            <circle cx="208" cy="148" r="4" fill="#B98863" />
          </g>

          <!-- mawar mini -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="pop flower" role="button" tabindex="0" aria-label="Mawar mini" onclick={(e) => tapFlower('mawar', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && tapFlower('mawar', e.currentTarget)}>
            <circle cx="150" cy="176" r="16" fill="#FFC9D9" />
            <path d="M150 176 m-9 0 a9 9 0 1 1 9 9 a6 6 0 1 1 -6 -6 a3 3 0 1 1 3 3" stroke-width="1.8" />
            <circle cx="68" cy="200" r="12" fill="#FBD3DE" />
            <path d="M68 200 m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 -3.5 -3.5" stroke-width="1.6" />
          </g>

          <!-- daisy -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="pop flower" role="button" tabindex="0" aria-label="Bunga daisy" onclick={(e) => tapFlower('daisy', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && tapFlower('daisy', e.currentTarget)}>
            {#each ring(10) as a (a)}<ellipse cx="112" cy="194" rx="5" ry="10" fill="#FFFFFF" transform="rotate({a} 112 206)" />{/each}
            <circle cx="112" cy="206" r="6" fill="#F6D58E" />
            {#each ring(9) as a (a)}<ellipse cx="232" cy="188" rx="4" ry="8" fill="#FFFFFF" transform="rotate({a} 232 198)" />{/each}
            <circle cx="232" cy="198" r="5" fill="#F6D58E" />
          </g>

          <!-- aster -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="pop flower" role="button" tabindex="0" aria-label="Bunga aster" onclick={(e) => tapFlower('aster', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && tapFlower('aster', e.currentTarget)}>
            {#each ring(14) as a (a)}<ellipse cx="192" cy="196" rx="2.6" ry="10" fill="#C3B1F0" transform="rotate({a} 192 206)" />{/each}
            <circle cx="192" cy="206" r="5" fill="#F6D58E" />
          </g>

          <!-- kertas depan (kerucut) + pita -->
          <path d="M66 222 C100 246 200 246 234 222 L150 384 Z" fill="#FBD3DE" />
          <path d="M96 238 L144 360 M204 238 L156 360 M150 246 L150 370" stroke-width="1.3" stroke-opacity="0.45" />
          <path d="M66 222 C100 246 200 246 234 222" stroke="#E0557A" stroke-width="1.6" stroke-dasharray="4 5" />
          <g fill="#9CCBF0">
            <path d="M150 304 C124 284 108 306 130 316 C140 320 146 312 150 304 Z" />
            <path d="M150 304 C176 284 192 306 170 316 C160 320 154 312 150 304 Z" />
            <path d="M144 308 L130 344 M156 308 L172 342" fill="none" />
            <circle cx="150" cy="306" r="6" />
          </g>

          <!-- kuncup tulip (Thumbelina) -->
          <circle class="bud-glow" cx="150" cy="96" r="0" fill="url(#budGlow)" stroke="none" opacity="0" />
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="tiny-letter" opacity="0" role="button" tabindex={phase === 'open' ? 0 : -1} aria-label="Buka surat" style:cursor={phase === 'open' ? 'pointer' : 'default'} onclick={() => phase === 'open' && game.next()} onkeydown={(e) => e.key === 'Enter' && phase === 'open' && game.next()}>
            <rect x="136" y="86" width="28" height="20" rx="2" fill="#FFFFFF" stroke-width="2" />
            <path d="M136 87 L150 98 L164 87" stroke-width="1.6" />
            <path d="M146 96 C146 93 150 93 150 95 C150 93 154 93 154 96 C154 99 150 101 150 101 C150 101 146 99 146 96 Z" fill="#E0557A" stroke-width="1" />
          </g>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g class="bud" role="button" tabindex="0" aria-label="Kuncup tulip. Ketuk untuk membuka." onclick={openBud} onkeydown={(e) => e.key === 'Enter' && openBud()}>
            <circle class="bud-ring" cx="150" cy="92" r="40" stroke="#C93D66" stroke-width="2" stroke-dasharray="5 6" />
            <path class="petal-l" d="M150 122 C124 110 122 74 138 62 C146 76 150 98 150 122 Z" fill="#F7A6BC" />
            <path class="petal-r" d="M150 122 C176 110 178 74 162 62 C154 76 150 98 150 122 Z" fill="#F7A6BC" />
            <path class="petal-f" d="M150 124 C132 110 134 76 150 58 C166 76 168 110 150 124 Z" fill="#FFC9D9" />
            <path class="petal-f" d="M150 70 C146 86 146 104 150 118" stroke-width="1.4" stroke-opacity="0.5" />
          </g>
        </svg>

        <!-- kelopak berguguran -->
        {#if !reducedMotion}
          {#each [0, 1, 2, 3, 4, 5] as i (i)}
            <span class="fall" style="left:{8 + i * 16}%; animation-delay:{i * 1.3}s; animation-duration:{6 + (i % 3)}s" aria-hidden="true">
              <svg viewBox="0 0 12 16" width="12" height="16"><path d="M6 1 C11 5 11 12 6 15 C1 12 1 5 6 1 Z" fill={['#F28AA5', '#FFC9D9', '#C3B1F0', '#F6D58E'][i % 4]} stroke="#23408E" stroke-width="1" /></svg>
            </span>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

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
  .head {
    min-height: 96px;
  }
  h1 {
    font-size: clamp(34px, 10vw, 42px);
    line-height: 1;
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
    max-height: 520px;
    aspect-ratio: 260 / 370;
    max-width: 100%;
  }
  .bouquet svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .flower,
  .bud {
    cursor: pointer;
    outline: none;
  }
  .flower:focus-visible,
  .bud:focus-visible {
    filter: drop-shadow(0 0 4px #c93d66);
  }
  .bud-ring {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 1.4s ease-in-out infinite;
  }
  .fall {
    position: absolute;
    top: -6%;
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
      transform: translate(18px, 45vh) rotate(160deg);
    }
    90% {
      opacity: 0.9;
    }
    100% {
      transform: translate(-10px, 85vh) rotate(320deg);
      opacity: 0;
    }
  }
  .foot {
    min-height: 64px;
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
