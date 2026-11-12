<script lang="ts">
  import gsap from 'gsap'
  import { config } from '../config'
  import { game } from '../lib/state.svelte'
  import { sfx, unlockAudio } from '../lib/audio'
  import { draw, vibrate } from '../lib/fx'
  import Icon from '../components/Icon.svelte'

  let dd = $state('')
  let mm = $state('')
  let wrong = $state(0)
  let shaking = $state(false)
  let opening = $state(false)
  let mmEl: HTMLInputElement
  let seal: SVGGElement

  const LUCU = ['Masa lupa ultah sendiri? 🙄', 'Hmm, coba lagi deh.', 'Itu tanggal ultah siapa?', 'Format: tanggal & bulan, misal 01 / 12']
  const valid = $derived(dd.length >= 1 && mm.length >= 1)

  function onDD(e: Event) {
    dd = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
    if (dd.length === 2) mmEl?.focus()
  }
  function onMM(e: Event) {
    mm = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
  }

  function submit(e: Event) {
    e.preventDefault()
    unlockAudio()
    if (!valid || opening) return
    if (Number(dd) === config.lahir.tanggal && Number(mm) === config.lahir.bulan) {
      opening = true
      sfx.unlock()
      vibrate(30)
      gsap
        .timeline({
          onComplete: () => {
            game.unlocked = true
            game.go('kado')
          },
        })
        .to(seal, { rotate: -25, scale: 1.25, transformOrigin: '120px 114px', duration: 0.3, ease: 'back.out(3)' })
        .to(seal, { y: 160, rotate: 40, opacity: 0, duration: 0.6, ease: 'power2.in' })
        .to('.envelope .flap', { scaleY: -1, transformOrigin: '120px 50px', duration: 0.5, ease: 'power2.inOut' }, '-=0.3')
    } else {
      wrong++
      sfx.wrong()
      vibrate(80)
      shaking = true
      setTimeout(() => (shaking = false), 450)
      game.say(LUCU[(wrong - 1) % LUCU.length])
    }
  }
</script>

<section class="scene">
  <svg class="sparkle" aria-hidden="true" viewBox="0 0 24 24" fill="#F6D58E" stroke="#23408E" stroke-width="1.2" stroke-linejoin="round"><path d="M12 2 C12.6 8 14 10.6 22 12 C14 13.4 12.6 16 12 22 C11.4 16 10 13.4 2 12 C10 10.6 11.4 8 12 2Z" /></svg>
  <svg class="balloons" aria-hidden="true" viewBox="0 0 92 150" fill="none" stroke="#23408E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" use:draw={{ delay: 0.6 }}>
    <path d="M30 8 C12 8 6 28 10 42 C14 56 24 64 30 66 C36 64 48 56 50 42 C53 26 46 8 30 8 Z" fill="#FBD3DE" />
    <path d="M30 72 C26 90 36 104 30 122 C26 134 32 142 34 148" />
    <path d="M64 30 C50 30 46 46 49 56 C52 66 59 72 64 73 C69 72 77 66 79 56 C81 44 76 30 64 30 Z" fill="#CFE6F7" />
    <path d="M64 78 C68 96 58 108 64 124 C66 132 60 140 58 146" />
  </svg>

  <div class="envelope-wrap" class:shake={shaking}>
    <svg class="envelope" role="img" aria-label="Amplop tersegel gembok" viewBox="0 0 240 180" fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" use:draw>
      <path d="M22 52 L218 48 L222 160 L18 164 Z" fill="#FFFFFF" />
      <path d="M24 55 L216 51 L219 157 L21 161 Z" stroke-opacity="0.35" stroke-width="1.4" />
      <path d="M18 164 L100 106" />
      <path d="M222 160 L142 104" />
      <path class="flap" d="M22 52 L120 114 L218 48" fill="#FBD3DE" />
      <path d="M40 140 L60 126 M48 148 L72 131 M178 132 L200 146 M168 138 L188 152" stroke-opacity="0.4" stroke-width="1.4" />
      <g bind:this={seal} data-nodraw>
        <circle cx="120" cy="114" r="27" fill="#E0557A" />
        <circle cx="121" cy="115" r="22" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="1.4" stroke-dasharray="3 4" />
        <path d="M112 112 V104 a8 8 0 0 1 16 0 V112" stroke="#FFFFFF" stroke-width="3" />
        <rect x="107" y="111" width="26" height="19" rx="4" fill="#FFFFFF" stroke="#FFFFFF" />
        <path d="M120 118 v5" stroke="#E0557A" stroke-width="3" />
      </g>
    </svg>
  </div>

  <div class="text">
    <h1 class="hand">Ada surat buat kamu</h1>
    <p>Tapi digembok dulu. Bukanya pakai tanggal &amp; bulan lahirmu.</p>
  </div>

  <form onsubmit={submit} class:shake={shaking}>
    <div class="fields">
      <div class="field">
        <label for="dd">Tanggal</label>
        <input id="dd" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="2" placeholder="DD" value={dd} oninput={onDD} />
      </div>
      <span class="slash hand" aria-hidden="true">/</span>
      <div class="field">
        <label for="mm">Bulan</label>
        <input id="mm" bind:this={mmEl} type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="2" placeholder="MM" value={mm} oninput={onMM} />
      </div>
    </div>
    <button class="btn pink" type="submit" disabled={!valid}>
      <Icon name="unlock" />
      Buka gemboknya
    </button>
  </form>

  <p class="hint hand" class:show={wrong >= 3}>psst… tanggal yang bikin kamu dapet kado tiap tahun</p>
</section>

<style>
  .scene {
    align-items: center;
    text-align: center;
    gap: clamp(12px, 2.6vh, 24px);
    padding-top: calc(48px + var(--safe-top));
  }
  .sparkle {
    position: absolute;
    left: 50px;
    top: calc(40px + var(--safe-top));
    width: 54px;
    transform: rotate(-12deg);
  }
  .balloons {
    position: absolute;
    right: 18px;
    top: calc(24px + var(--safe-top));
    width: 80px;
  }
  .envelope-wrap {
    width: min(250px, 62vw);
    margin-top: clamp(40px, 9vh, 96px);
  }
  .envelope {
    width: 100%;
    max-height: 26vh;
    display: block;
    overflow: visible;
  }
  h1 {
    font-size: clamp(38px, 11vw, 48px);
    line-height: 1;
  }
  .text p {
    margin-top: 10px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--muted);
    max-width: 290px;
  }
  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }
  .fields {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  label {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  input {
    width: 76px;
    height: 64px;
    border: 2.5px solid var(--ink);
    border-radius: 14px 10px 16px 11px;
    background: #fff;
    font-family: var(--sans);
    font-weight: 800;
    font-size: 28px;
    color: var(--ink);
    text-align: center;
    letter-spacing: 2px;
  }
  input::placeholder {
    color: #9aa6c8;
  }
  .slash {
    font-size: 48px;
    line-height: 64px;
    color: var(--pink);
  }
  .btn {
    min-width: 230px;
  }
  .hint {
    margin-top: auto;
    font-size: 22px;
    font-weight: 500;
    color: var(--muted-2);
    opacity: 0;
    transition: opacity 0.5s;
  }
  .hint.show {
    opacity: 1;
  }
  .shake {
    animation: shake 0.45s;
  }
</style>
