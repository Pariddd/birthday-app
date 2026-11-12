import { config } from '../config'

export const SCENES = [
  { id: 'kunci', judul: 'Kunci' },
  { id: 'kado', judul: 'Buka kado' },
  { id: 'umur', judul: 'Fakta umur' },
  { id: 'warnai', judul: 'Warnai kue' },
  { id: 'sparkler', judul: 'Tulis umur' },
  { id: 'lilin', judul: 'Tiup lilin' },
  { id: 'surat', judul: 'Surat' },
  { id: 'arcade', judul: 'Arcade' },
  { id: 'claw', judul: 'Claw machine' },
  { id: 'album', judul: 'Album' },
  { id: 'photobooth', judul: 'Photobooth' },
  { id: 'memory', judul: 'Memory match' },
  { id: 'tebak', judul: 'Tebak foto' },
  { id: 'lari', judul: 'Lari Cupcake' },
] as const

export type SceneId = (typeof SCENES)[number]['id']
export type CakeArea = 'alas' | 'krim' | 'atas' | 'bawah' | 'stroberi'
export type CakeColors = Partial<Record<CakeArea, string>>

const KEY = 'ulangtahun-dilla-v1'

interface Saved {
  scene: SceneId
  unlocked: boolean
  finished: boolean
  cake: CakeColors
  coins: number
  collected: number[]
  doa: number[]
  best: number
  doaGame: boolean
  secrets: number[]
  muted: boolean
}

function load(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Partial<Saved>) : {}
  } catch {
    return {}
  }
}

class Game {
  scene = $state<SceneId>('kunci')
  unlocked = $state(false)
  finished = $state(false)
  cake = $state<CakeColors>({})
  coins = $state(config.koinAwal)
  collected = $state<number[]>([])
  doa = $state<number[]>([])
  best = $state(0)
  doaGame = $state(false)
  secrets = $state<number[]>([])
  muted = $state(false)
  toast = $state<{ text: string; id: number } | null>(null)
  menuOpen = $state(false)

  constructor() {
    const s = load()
    if (s.unlocked) {
      this.unlocked = true
      this.scene = s.scene && SCENES.some((x) => x.id === s.scene) ? s.scene : 'kado'
    }
    this.finished = !!s.finished
    this.cake = s.cake ?? {}
    this.coins = typeof s.coins === 'number' ? s.coins : config.koinAwal
    this.collected = Array.isArray(s.collected) ? s.collected : []
    this.doa = Array.isArray(s.doa) ? s.doa : []
    this.best = typeof s.best === 'number' ? s.best : 0
    this.doaGame = !!s.doaGame
    this.secrets = Array.isArray(s.secrets) ? s.secrets : []
    this.muted = !!s.muted
  }

  save() {
    const data: Saved = {
      scene: this.scene,
      unlocked: this.unlocked,
      finished: this.finished,
      cake: $state.snapshot(this.cake),
      coins: this.coins,
      collected: $state.snapshot(this.collected),
      doa: $state.snapshot(this.doa),
      best: this.best,
      doaGame: this.doaGame,
      secrets: $state.snapshot(this.secrets),
      muted: this.muted,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* private mode: progres tidak tersimpan, website tetap jalan */
    }
  }

  go(id: SceneId) {
    this.scene = id
    this.menuOpen = false
    this.save()
  }

  next() {
    const i = SCENES.findIndex((s) => s.id === this.scene)
    if (i < SCENES.length - 1) this.go(SCENES[i + 1].id)
  }

  findSecret(i: number) {
    if (!this.secrets.includes(i)) {
      this.secrets = [...this.secrets, i]
      if (i === 2) this.coins += 3
      this.save()
    }
    this.say(config.pesanRahasia[i], 5200)
  }

  say(text: string, ms = 2600) {
    const id = Date.now()
    this.toast = { text, id }
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null
    }, ms)
  }

  reset() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* abaikan */
    }
    location.reload()
  }
}

export const game = new Game()

export const reducedMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
