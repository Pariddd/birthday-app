<script lang="ts">
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import gsap from 'gsap'
  import { config } from '../config'
  import { game, reducedMotion } from '../lib/state.svelte'
  import { sfx } from '../lib/audio'
  import Icon from '../components/Icon.svelte'

  const paras = [`${config.nama},`, ...config.surat]
  const total = paras.reduce((n, p) => n + p.length, 0)

  let shown = $state(reducedMotion ? total : 0)
  let caret = $state<HTMLSpanElement>()
  let sheet: HTMLElement
  let flap: SVGPathElement
  const done = $derived(shown >= total)

  const visible = $derived.by(() => {
    let left = shown
    return paras.map((p) => {
      const take = Math.max(0, Math.min(p.length, left))
      left -= take
      return { text: p.slice(0, take), full: take === p.length, started: take > 0 }
    })
  })

  const wa = `https://wa.me/${config.nomorWhatsApp}?text=${encodeURIComponent(config.pesanBalasan)}`

  let timer: ReturnType<typeof setInterval> | undefined
  onMount(() => {
    if (!reducedMotion) {
      gsap
        .timeline()
        .fromTo(flap, { scaleY: -1 }, { scaleY: 1, transformOrigin: '50% 100%', duration: 0.6, ease: 'power2.out', delay: 0.4 })
        .from(sheet, { y: 120, opacity: 0, duration: 0.7, ease: 'back.out(1.2)' }, '-=0.2')
        .add(() => {
          timer = setInterval(() => {
            shown = Math.min(total, shown + 1)
            if (shown % 3 === 0) caret?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            if (shown >= total) finish()
          }, 32)
        })
    } else finish()
    return () => clearInterval(timer)
  })

  function skip() {
    if (done) return
    shown = total
    finish()
  }

  function finish() {
    clearInterval(timer)
    if (!game.finished) {
      game.finished = true
      game.save()
      setTimeout(() => game.say('Daftar isi sudah kebuka di pojok kiri atas.', 3600), 1500)
    }
    sfx.pop()
  }
</script>

<section class="scene">
  <svg class="env" viewBox="0 0 390 120" fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path bind:this={flap} d="M60 116 L195 10 L330 116" fill="#FBD3DE" />
    <path d="M70 116 L195 20 L320 116" stroke-opacity="0.35" stroke-width="1.4" />
    <circle cx="195" cy="50" r="16" fill="#C93D66" />
    <path d="M187 46 l8 9 l8 -9" stroke="#FFFFFF" stroke-width="2.4" />
  </svg>

  <div class="sheet-wrap">
    <span class="tape a" aria-hidden="true"></span>
    <span class="tape b" aria-hidden="true"></span>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="sheet" bind:this={sheet} onclick={skip} aria-label="Surat dari {config.pengirim}">
      <p class="sr-only">{paras.join(' ')} — {config.pengirim}</p>
      <div aria-hidden="true">
        {#each visible as p, i (i)}
          {#if p.started}
            <p class:first={i === 0}>
              {p.text}{#if !p.full}<span class="caret" bind:this={caret}></span>{/if}
            </p>
          {/if}
        {/each}
        {#if done}
          <p class="sign" in:fly={{ y: 10, duration: 400 }}>— {config.pengirim}</p>
        {/if}
      </div>
    </article>
    {#if !done}<p class="skip">ketuk suratnya untuk langsung baca semua</p>{/if}
  </div>

  {#if done}
    <div class="actions" in:fly={{ y: 20, duration: 400, delay: 400 }}>
      <a class="btn" href={wa} target="_blank" rel="noopener"><Icon name="chat" /> Balas ucapan ini</a>
      <button class="btn ghost" onclick={() => game.go('arcade')}><Icon name="joystick" /> Masih ada bonus…</button>
    </div>
  {/if}
</section>

<style>
  .scene {
    padding-left: 30px;
    padding-right: 20px;
  }
  .env {
    width: 100%;
    flex-shrink: 0;
    margin-top: -12px;
  }
  .sheet-wrap {
    position: relative;
    margin-top: -36px;
  }
  .tape {
    position: absolute;
    top: -12px;
    width: 86px;
    height: 28px;
    z-index: 2;
  }
  .tape.a {
    left: 10px;
    background: rgba(242, 138, 165, 0.55);
    transform: rotate(-8deg);
  }
  .tape.b {
    right: 8px;
    background: rgba(142, 211, 190, 0.6);
    transform: rotate(6deg);
  }
  .sheet {
    position: relative;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 6px 10px 8px 12px;
    box-shadow: 5px 5px 0 var(--pink-soft);
    transform: rotate(-0.8deg);
    padding: 36px 24px 30px;
    font-family: var(--hand);
    font-size: 24px;
    line-height: 1.35;
    color: var(--ink);
    min-height: 200px;
    cursor: pointer;
  }
  .sheet div {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .first {
    font-weight: 700;
    font-size: 32px;
  }
  .sign {
    align-self: flex-end;
    font-weight: 700;
    font-size: 30px;
    color: var(--pink-dark);
  }
  .caret {
    display: inline-block;
    width: 2px;
    height: 1em;
    margin-left: 2px;
    background: var(--pink);
    vertical-align: -0.12em;
    animation: blink 0.8s steps(2) infinite;
  }
  .skip {
    margin-top: 14px;
    text-align: center;
    font-size: 13px;
    color: var(--muted-2);
  }
  .actions {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 12px;
  }
</style>
