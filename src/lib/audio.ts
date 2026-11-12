// Musik latar (opsional, dari file) + efek suara yang disintesis langsung (tanpa file).
// Semua audio baru dimulai setelah ada ketukan pengguna — syarat iOS Safari & Chrome.
import { config } from '../config'
import { game } from './state.svelte'

let ctx: AudioContext | null = null
let music: HTMLAudioElement | null = null

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AC) ctx = new AC()
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function startMusic() {
  unlockAudio()
  if (!music) {
    music = new Audio(config.musik)
    music.loop = true
    music.volume = 0.45
    music.preload = 'auto'
    music.addEventListener('error', () => {
      music = null // file lagu belum ada: diam saja
    })
  }
  if (music && !game.muted) void music.play().catch(() => {})
}

export function setMuted(m: boolean) {
  game.muted = m
  game.save()
  if (!music) return
  if (m) music.pause()
  else void music.play().catch(() => {})
}

export function duckMusic(on: boolean) {
  if (music) music.volume = on ? 0.08 : 0.45
}

type Tone = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number }

function play(tones: Tone[]) {
  if (game.muted || !ctx) return
  const now = ctx.currentTime
  for (const tn of tones) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = tn.type ?? 'sine'
    o.frequency.setValueAtTime(tn.f, now + tn.t)
    if (tn.slide) o.frequency.exponentialRampToValueAtTime(tn.slide, now + tn.t + tn.d)
    const peak = tn.g ?? 0.18
    g.gain.setValueAtTime(0.0001, now + tn.t)
    g.gain.exponentialRampToValueAtTime(peak, now + tn.t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, now + tn.t + tn.d)
    o.connect(g).connect(ctx.destination)
    o.start(now + tn.t)
    o.stop(now + tn.t + tn.d + 0.05)
  }
}

function noise(dur: number, gain = 0.2, freq = 1200) {
  if (game.muted || !ctx) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(ctx.destination)
  src.start()
}

export const sfx = {
  pop: () => play([{ f: 520, t: 0, d: 0.12, slide: 900, type: 'triangle' }]),
  // ketukan kado: nada naik tiap level supaya terasa "makin tegang"
  charge: (level: number) =>
    play([
      { f: 260 + level * 110, t: 0, d: 0.09, type: 'square', g: 0.06 },
      { f: 330 + level * 140, t: 0.05, d: 0.14, type: 'triangle', g: 0.12, slide: 420 + level * 180 },
    ]),
  boom: () => {
    noise(0.7, 0.5, 300)
    play([{ f: 180, t: 0, d: 0.5, type: 'sine', g: 0.35, slide: 50 }])
  },
  tap: () => play([{ f: 660, t: 0, d: 0.06, type: 'triangle', g: 0.1 }]),
  wrong: () => play([{ f: 220, t: 0, d: 0.14, type: 'square', g: 0.06 }, { f: 180, t: 0.12, d: 0.16, type: 'square', g: 0.06 }]),
  unlock: () => play([{ f: 523, t: 0, d: 0.12 }, { f: 659, t: 0.1, d: 0.12 }, { f: 784, t: 0.2, d: 0.25 }]),
  tada: () =>
    play([
      { f: 523, t: 0, d: 0.15, type: 'triangle' },
      { f: 659, t: 0.12, d: 0.15, type: 'triangle' },
      { f: 784, t: 0.24, d: 0.15, type: 'triangle' },
      { f: 1047, t: 0.36, d: 0.45, type: 'triangle' },
    ]),
  dot: (i: number) => play([{ f: 440 * Math.pow(2, (i % 12) / 12), t: 0, d: 0.12, type: 'sine', g: 0.12 }]),
  fwoosh: () => noise(0.35, 0.25, 900),
  blow: () => noise(0.6, 0.3, 500),
  claw: () => play([{ f: 300, t: 0, d: 0.5, type: 'sawtooth', g: 0.03, slide: 200 }]),
  coin: () => play([{ f: 988, t: 0, d: 0.08, type: 'square', g: 0.05 }, { f: 1319, t: 0.08, d: 0.2, type: 'square', g: 0.05 }]),
  shutter: () => noise(0.12, 0.3, 3000),
}
