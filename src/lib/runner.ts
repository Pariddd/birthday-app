// ============================================================
//  LARI CUPCAKE — endless runner bergaya doodle (canvas 2D).
//  Satuan dunia: tinggi selalu 400 unit; lebar mengikuti rasio layar.
//  Fisika memakai dt (detik) supaya kecepatan sama di HP 60Hz & 120Hz.
// ============================================================

export type Cause = 'brokoli' | 'jam' | 'buku' | 'pesawat'

interface Obs {
  kind: Cause
  x: number
  y: number // tepi bawah
  w: number
  h: number
  phase: number
  stack: number
}
interface Candle {
  x: number
  y: number
  got: boolean
  phase: number
}
interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  c: string
}
interface Deco {
  x: number
  y: number
  kind: 0 | 1 | 2
  s: number
}

export interface RunnerEvents {
  onScore?: (score: number, candles: number) => void
  onDie?: (cause: Cause, score: number, candles: number) => void
  onJump?: () => void
  onCandle?: () => void
  onLand?: () => void
}

const INK = '#23408E'
const H = 400
const GROUND = 330
const GRAV = 2700
const GRAV_HOLD = 1250 // gravitasi saat tombol masih ditahan di awal lompatan
const HOLD_WINDOW = 0.22
const JUMP_V = -860
const CUT_V = -440 // lepas cepat = lompatan pendek (tetap cukup untuk melewati brokoli)
const SPEED0 = 330
const SPEED_MAX = 720
const ACCEL = 9 // unit/detik per detik
// Jarak aman lilin dari rintangan. Deret 3 lilin selebar ±80 unit; rintangan terlebar ±62 unit;
// pesawat bergerak +70 unit/detik lebih cepat sehingga bisa "menyusul" lilin dari belakang.
const CANDLE_BEHIND = 120
const CANDLE_AHEAD = 260

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export class Runner {
  state: 'ready' | 'run' | 'dead' | 'paused' = 'ready'
  score = 0
  candles = 0

  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private k = 1 // skala piksel CSS per unit dunia
  private W = 400
  private raf = 0
  private last = 0
  private time = 0
  private speed = SPEED0
  private dist = 0
  private scroll = 0
  private obs: Obs[] = []
  private cds: Candle[] = []
  private puffs: Puff[] = []
  private decos: Deco[] = []
  private nextObs = 0
  private sinceObs = 999 // jarak tempuh sejak rintangan terakhir muncul
  private nextCandle = 0
  private lastKind: Cause | null = null
  private cause: Cause = 'brokoli'
  private deadT = 0
  private p = { x: 46, y: GROUND, vy: 0, w: 36, h: 46, ground: true, holding: false, holdT: 0, leg: 0, sy: 1 }

  constructor(
    private canvas: HTMLCanvasElement,
    private ev: RunnerEvents = {},
  ) {
    this.ctx = canvas.getContext('2d')!
    this.reset()
    this.raf = requestAnimationFrame(this.frame)
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(cssW * this.dpr)
    this.canvas.height = Math.round(cssH * this.dpr)
    this.k = cssH / H
    this.W = cssW / this.k
    if (!this.decos.length) this.seedDecos()
  }

  reset() {
    this.state = 'ready'
    this.time = 0
    this.speed = SPEED0
    this.dist = 0
    this.score = 0
    this.candles = 0
    this.obs = []
    this.cds = []
    this.puffs = []
    this.nextObs = 520
    this.sinceObs = 999
    this.nextCandle = 380
    this.lastKind = null
    this.deadT = 0
    Object.assign(this.p, { y: GROUND, vy: 0, ground: true, holding: false, holdT: 0, sy: 1 })
    this.ev.onScore?.(0, 0)
  }

  /** Jari/tombol ditekan */
  press() {
    if (this.state === 'ready') this.state = 'run'
    if (this.state !== 'run') return
    this.p.holding = true
    if (this.p.ground) {
      this.p.vy = JUMP_V
      this.p.ground = false
      this.p.holdT = 0
      this.p.sy = 1.25
      this.ev.onJump?.()
      this.dust(this.p.x + this.p.w / 2, GROUND, 4)
    }
  }

  /** Jari/tombol dilepas */
  release() {
    this.p.holding = false
    if (this.p.vy < CUT_V) this.p.vy = CUT_V
  }

  pause() {
    if (this.state === 'run') this.state = 'paused'
  }
  resume() {
    if (this.state === 'paused') {
      this.state = 'run'
      this.last = performance.now()
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf)
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    const dt = Math.min(0.033, Math.max(0, (now - (this.last || now)) / 1000))
    this.last = now
    this.update(dt)
    this.draw(now / 1000)
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number) {
    const p = this.p
    // partikel tetap jalan di semua state
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i]
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += 300 * dt
      f.life -= dt * 2.2
      if (f.life <= 0) this.puffs.splice(i, 1)
    }

    if (this.state === 'dead') {
      this.deadT += dt
      p.vy += GRAV * dt
      p.y = Math.min(GROUND, p.y + p.vy * dt)
      return
    }
    if (this.state === 'ready') {
      p.leg += dt * 4
      this.scroll += 40 * dt
      return
    }
    if (this.state !== 'run') return

    this.time += dt
    this.speed = Math.min(SPEED_MAX, SPEED0 + this.time * ACCEL)
    const dx = this.speed * dt
    this.dist += dx
    this.scroll += dx

    // pemain
    p.holdT += dt
    const g = p.holding && p.holdT < HOLD_WINDOW && p.vy < 0 ? GRAV_HOLD : GRAV
    if (!p.ground) {
      p.vy += g * dt
      p.y += p.vy * dt
      if (p.y >= GROUND) {
        p.y = GROUND
        p.vy = 0
        p.ground = true
        p.sy = 0.78
        this.dust(p.x + p.w / 2, GROUND, 6)
        this.ev.onLand?.()
      }
    }
    p.sy += (1 - p.sy) * Math.min(1, dt * 12)
    p.leg += dt * (6 + this.speed / 60)

    // dekorasi latar (parallax)
    for (const d of this.decos) {
      d.x -= dx * (0.15 + d.s * 0.1)
      if (d.x < -60) {
        d.x = this.W + rand(20, 200)
        d.y = rand(30, 190)
      }
    }

    // rintangan
    this.nextObs -= dx
    if (this.nextObs <= 0) this.spawnObs()
    for (const o of this.obs) {
      o.x -= dx + (o.kind === 'pesawat' ? 70 * dt : 0)
      o.phase += dt
    }
    this.obs = this.obs.filter((o) => o.x + o.w > -20)

    // lilin: hanya muncul di celah yang benar-benar kosong.
    //  - CANDLE_BEHIND: rintangan terakhir sudah lewat penuh dari titik muncul lilin
    //  - CANDLE_AHEAD : rintangan berikutnya (termasuk pesawat yang lebih cepat) belum akan menyusul
    this.sinceObs += dx
    this.nextCandle -= dx
    if (this.nextCandle <= 0 && this.sinceObs > CANDLE_BEHIND && this.nextObs > CANDLE_AHEAD) this.spawnCandles()
    for (const c of this.cds) {
      c.x -= dx
      c.phase += dt
    }
    this.cds = this.cds.filter((c) => c.x > -20 && !c.got)

    // tabrakan (hitbox sedikit lebih kecil dari gambar = terasa adil)
    const px1 = p.x + 7
    const px2 = p.x + p.w - 7
    const py1 = p.y - p.h + 10
    const py2 = p.y - 2
    for (const o of this.obs) {
      const m = 5
      if (px2 > o.x + m && px1 < o.x + o.w - m && py2 > o.y - o.h + m && py1 < o.y - m) {
        this.die(o.kind)
        return
      }
    }
    for (const c of this.cds) {
      if (!c.got && px2 > c.x - 4 && px1 < c.x + 16 && py2 > c.y - 30 && py1 < c.y + 2) {
        c.got = true
        this.candles++
        this.sparkle(c.x + 6, c.y - 16)
        this.ev.onCandle?.()
      }
    }

    const s = Math.floor(this.dist / 12) + this.candles * 10
    if (s !== this.score) {
      this.score = s
      this.ev.onScore?.(s, this.candles)
    }
  }

  private die(cause: Cause) {
    this.state = 'dead'
    this.cause = cause
    this.p.vy = -420
    this.p.ground = false
    this.dust(this.p.x + this.p.w / 2, this.p.y - 20, 14)
    this.ev.onDie?.(cause, this.score, this.candles)
  }

  private spawnObs() {
    const sc = this.score
    // makin tinggi skor, makin banyak variasi
    const pool: Cause[] = ['brokoli', 'brokoli', 'jam']
    if (sc > 120) pool.push('buku', 'jam')
    if (sc > 350 && this.lastKind !== 'pesawat') pool.push('pesawat')
    const kind = pool[(Math.random() * pool.length) | 0]
    let w = 32
    let h = 40
    let y = GROUND
    let stack = 1
    if (kind === 'brokoli') {
      stack = sc > 220 && Math.random() < 0.35 ? 2 : 1
      w = 30 * stack + (stack - 1) * 2
      h = 38
    } else if (kind === 'jam') {
      w = 34
      h = 40
    } else if (kind === 'buku') {
      stack = sc > 600 && Math.random() < 0.4 ? 5 : Math.random() < 0.5 ? 4 : 3
      w = 42
      h = stack * 14
    } else {
      // pesawat kertas setinggi kepala: aman kalau tetap lari, kena kalau asal lompat
      w = 44
      h = 20
      y = GROUND - rand(78, 92)
    }
    this.obs.push({ kind, x: this.W + 20, y, w, h, phase: Math.random() * 6, stack })
    this.lastKind = kind
    this.sinceObs = 0
    // jarak aman: minimal waktu mendarat + reaksi, makin cepat makin lebar jaraknya
    const minGap = this.speed * 0.85 + 150 + (kind === 'pesawat' ? 120 : 0)
    this.nextObs = minGap + Math.random() * this.speed * 0.7
  }

  private spawnCandles() {
    const high = Math.random() < 0.5
    const y = high ? GROUND - 120 : GROUND - 6
    const n = 3
    for (let i = 0; i < n; i++) this.cds.push({ x: this.W + 20 + i * 34, y: y - (high ? Math.sin((i / (n - 1)) * Math.PI) * 26 : 0), got: false, phase: i * 0.6 })
    this.nextCandle = rand(700, 1500)
  }

  private seedDecos() {
    this.decos = []
    for (let i = 0; i < 6; i++) this.decos.push({ x: rand(0, this.W + 200), y: rand(30, 190), kind: (i % 3) as 0 | 1 | 2, s: Math.random() })
  }

  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++)
      this.puffs.push({ x, y, vx: rand(-90, 90), vy: rand(-140, -30), life: 1, size: rand(3, 6), c: '#B4BED8' })
  }
  private sparkle(x: number, y: number) {
    const C = ['#F6D58E', '#F28AA5', '#9CCBF0']
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.puffs.push({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 1, size: 3, c: C[i % 3] })
    }
  }

  // ---------------------------------------------------------------- gambar
  private draw(t: number) {
    const c = this.ctx
    c.setTransform(this.dpr * this.k, 0, 0, this.dpr * this.k, 0, 0)
    c.lineCap = 'round'
    c.lineJoin = 'round'

    // kertas bergaris
    c.fillStyle = '#FBF8F1'
    c.fillRect(0, 0, this.W, H)
    c.strokeStyle = '#DCE5F3'
    c.lineWidth = 1.2
    for (let y = 28; y < GROUND; y += 30) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(this.W, y)
      c.stroke()
    }

    for (const d of this.decos) this.drawDeco(d)

    // tanah
    c.strokeStyle = INK
    c.lineWidth = 2.6
    c.beginPath()
    for (let x = 0; x <= this.W + 12; x += 12) {
      const y = GROUND + Math.sin((x + this.scroll) * 0.045) * 1.3
      if (x === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    c.lineWidth = 1.4
    c.strokeStyle = '#9AA6C8'
    const off = this.scroll % 22
    for (let x = -off; x < this.W; x += 22) {
      c.beginPath()
      c.moveTo(x, GROUND + 10)
      c.lineTo(x + 8, GROUND + 4)
      c.stroke()
    }
    for (let x = -((this.scroll * 1.0 + 11) % 38); x < this.W; x += 38) {
      c.beginPath()
      c.moveTo(x, GROUND + 24)
      c.lineTo(x + 12, GROUND + 18)
      c.stroke()
    }

    for (const cd of this.cds) this.drawCandle(cd, t)
    for (const o of this.obs) this.drawObs(o, t)
    this.drawPlayer(t)

    for (const f of this.puffs) {
      c.globalAlpha = Math.max(0, f.life)
      c.fillStyle = f.c
      c.beginPath()
      c.arc(f.x, f.y, f.size, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  private drawDeco(d: Deco) {
    const c = this.ctx
    c.save()
    c.translate(d.x, d.y)
    c.strokeStyle = '#B4BED8'
    c.lineWidth = 1.6
    if (d.kind === 0) {
      // awan
      c.beginPath()
      c.moveTo(0, 0)
      c.bezierCurveTo(-6, -12, 10, -18, 16, -10)
      c.bezierCurveTo(20, -22, 42, -20, 42, -8)
      c.bezierCurveTo(54, -8, 54, 6, 42, 6)
      c.lineTo(2, 6)
      c.bezierCurveTo(-8, 6, -8, 0, 0, 0)
      c.stroke()
    } else if (d.kind === 1) {
      // bintang
      c.fillStyle = '#FFF0B3'
      c.beginPath()
      c.moveTo(0, -9)
      c.quadraticCurveTo(1, -1, 9, 0)
      c.quadraticCurveTo(1, 1, 0, 9)
      c.quadraticCurveTo(-1, 1, -9, 0)
      c.quadraticCurveTo(-1, -1, 0, -9)
      c.fill()
      c.stroke()
    } else {
      // balon kecil
      c.fillStyle = '#FBD3DE'
      c.beginPath()
      c.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      c.beginPath()
      c.moveTo(0, 10)
      c.quadraticCurveTo(-4, 18, 0, 26)
      c.stroke()
    }
    c.restore()
  }

  private drawPlayer(t: number) {
    const c = this.ctx
    const p = this.p
    const dead = this.state === 'dead'
    c.save()
    c.translate(p.x + p.w / 2, p.y)
    c.scale(1 / p.sy ** 0.5, p.sy)
    if (dead) c.rotate(Math.min(1.2, this.deadT * 4) * -1)
    c.strokeStyle = INK
    c.lineWidth = 2.4

    // kaki
    if (p.ground && !dead) {
      const a = Math.sin(p.leg) * 4
      c.beginPath()
      c.moveTo(-7, -6)
      c.lineTo(-7 + a, 0)
      c.moveTo(7, -6)
      c.lineTo(7 - a, 0)
      c.stroke()
    } else {
      c.beginPath()
      c.moveTo(-7, -6)
      c.lineTo(-10, -2)
      c.moveTo(7, -6)
      c.lineTo(10, -2)
      c.stroke()
    }
    // wadah cupcake (bergaris)
    c.fillStyle = '#F28AA5'
    c.beginPath()
    c.moveTo(-12, -6)
    c.lineTo(12, -6)
    c.lineTo(16, -26)
    c.lineTo(-16, -26)
    c.closePath()
    c.fill()
    c.stroke()
    c.lineWidth = 1.3
    c.beginPath()
    for (const x of [-8, 0, 8]) {
      c.moveTo(x * 0.85, -7)
      c.lineTo(x * 1.05, -25)
    }
    c.stroke()
    // krim
    c.lineWidth = 2.4
    c.fillStyle = '#FFFDF5'
    c.beginPath()
    c.moveTo(-18, -26)
    c.bezierCurveTo(-25, -34, -15, -43, -8, -38)
    c.bezierCurveTo(-6, -49, 8, -49, 9, -38)
    c.bezierCurveTo(16, -43, 25, -34, 18, -26)
    c.closePath()
    c.fill()
    c.stroke()
    // taburan
    const spr = ['#9CCBF0', '#F6D58E', '#8ED3BE', '#C3B1F0']
    c.lineWidth = 2
    ;[
      [-10, -32, 0.6],
      [-2, -40, -0.4],
      [7, -33, 0.9],
      [12, -29, -0.2],
    ].forEach(([x, y, r], i) => {
      c.strokeStyle = spr[i]
      c.beginPath()
      c.moveTo(x - Math.cos(r) * 2.5, y - Math.sin(r) * 2.5)
      c.lineTo(x + Math.cos(r) * 2.5, y + Math.sin(r) * 2.5)
      c.stroke()
    })
    c.strokeStyle = INK
    // lilin + api
    c.lineWidth = 2
    c.fillStyle = '#CFE6F7'
    c.fillRect(-2.5, -58, 5, 12)
    c.strokeRect(-2.5, -58, 5, 12)
    if (!dead) {
      const fl = 1 + Math.sin(t * 22) * 0.12
      c.fillStyle = '#F6D58E'
      c.beginPath()
      c.moveTo(0, -60 - 10 * fl)
      c.quadraticCurveTo(5, -62, 0, -59)
      c.quadraticCurveTo(-5, -62, 0, -60 - 10 * fl)
      c.fill()
      c.lineWidth = 1.4
      c.stroke()
    } else {
      c.strokeStyle = '#9AA6C8'
      c.beginPath()
      c.moveTo(0, -60)
      c.bezierCurveTo(-4, -66, 4, -70, 0, -78)
      c.stroke()
      c.strokeStyle = INK
    }
    // wajah
    c.lineWidth = 2
    if (dead) {
      for (const ex of [-5, 5]) {
        c.beginPath()
        c.moveTo(ex - 2.5, -19.5)
        c.lineTo(ex + 2.5, -14.5)
        c.moveTo(ex + 2.5, -19.5)
        c.lineTo(ex - 2.5, -14.5)
        c.stroke()
      }
    } else {
      c.fillStyle = INK
      const blink = Math.sin(t * 1.3) > 0.97
      for (const ex of [-5, 5]) {
        c.beginPath()
        if (blink) {
          c.moveTo(ex - 2, -17)
          c.lineTo(ex + 2, -17)
          c.stroke()
        } else {
          c.arc(ex, -17, 1.9, 0, Math.PI * 2)
          c.fill()
        }
      }
      c.beginPath()
      c.arc(0, -13, 2.6, 0.15 * Math.PI, 0.85 * Math.PI)
      c.stroke()
    }
    c.restore()
  }

  private drawObs(o: Obs, t: number) {
    const c = this.ctx
    c.save()
    c.translate(o.x, o.y)
    c.strokeStyle = INK
    c.lineWidth = 2.4
    if (o.kind === 'brokoli') {
      for (let i = 0; i < o.stack; i++) {
        c.save()
        c.translate(i * 32, 0)
        c.fillStyle = '#CFEFDF'
        c.fillRect(11, -18, 8, 18)
        c.strokeRect(11, -18, 8, 18)
        c.fillStyle = '#8ED3BE'
        for (const [x, y, r] of [
          [7, -24, 8.5],
          [23, -24, 8.5],
          [15, -31, 10],
        ]) {
          c.beginPath()
          c.arc(x, y, r, 0, Math.PI * 2)
          c.fill()
          c.stroke()
        }
        // mata galak
        c.fillStyle = INK
        c.beginPath()
        c.arc(11.5, -28, 1.5, 0, Math.PI * 2)
        c.arc(18.5, -28, 1.5, 0, Math.PI * 2)
        c.fill()
        c.lineWidth = 1.6
        c.beginPath()
        c.moveTo(9, -33)
        c.lineTo(13.5, -31)
        c.moveTo(21, -33)
        c.lineTo(16.5, -31)
        c.stroke()
        c.restore()
      }
    } else if (o.kind === 'jam') {
      const sh = Math.sin(t * 40) * 1.2
      c.translate(sh, 0)
      c.fillStyle = '#F6D58E'
      for (const bx of [7, 27]) {
        c.beginPath()
        c.arc(bx, -34, 5, 0, Math.PI * 2)
        c.fill()
        c.stroke()
      }
      c.beginPath()
      c.moveTo(8, -2)
      c.lineTo(5, 0)
      c.moveTo(26, -2)
      c.lineTo(29, 0)
      c.stroke()
      c.fillStyle = '#FFF4CC'
      c.beginPath()
      c.arc(17, -18, 15, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(17, -18)
      c.lineTo(17, -28)
      c.moveTo(17, -18)
      c.lineTo(24, -16)
      c.stroke()
      // garis "kring kring"
      c.strokeStyle = '#E0557A'
      c.beginPath()
      c.moveTo(-4, -36)
      c.lineTo(-9, -40)
      c.moveTo(38, -36)
      c.lineTo(43, -40)
      c.stroke()
    } else if (o.kind === 'buku') {
      const COL = ['#9CCBF0', '#F28AA5', '#C3B1F0', '#8ED3BE', '#F6D58E']
      for (let i = 0; i < o.stack; i++) {
        const off = (i % 2 ? 3 : -2) + (i === o.stack - 1 ? 2 : 0)
        c.fillStyle = COL[i % COL.length]
        c.fillRect(off, -(i + 1) * 14, 40, 14)
        c.strokeRect(off, -(i + 1) * 14, 40, 14)
        c.fillStyle = '#FFFFFF'
        c.fillRect(off + 33, -(i + 1) * 14 + 3, 5, 8)
      }
      c.fillStyle = INK
      c.font = '700 13px Caveat, cursive'
      c.fillText('tugas', 6, -o.stack * 14 + 10)
    } else {
      const bob = Math.sin(o.phase * 6) * 3
      c.translate(0, bob)
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.moveTo(0, -10)
      c.lineTo(44, -20)
      c.lineTo(30, 0)
      c.closePath()
      c.fill()
      c.stroke()
      c.lineWidth = 1.6
      c.beginPath()
      c.moveTo(0, -10)
      c.lineTo(30, -7)
      c.lineTo(44, -20)
      c.stroke()
      c.strokeStyle = '#B4BED8'
      c.beginPath()
      c.moveTo(52, -14)
      c.lineTo(64, -14)
      c.moveTo(50, -6)
      c.lineTo(58, -6)
      c.stroke()
    }
    c.restore()
  }

  private drawCandle(cd: Candle, t: number) {
    const c = this.ctx
    const bob = Math.sin(t * 4 + cd.phase) * 2.5
    c.save()
    c.translate(cd.x, cd.y + bob)
    c.fillStyle = 'rgba(246,213,142,0.35)'
    c.beginPath()
    c.arc(6, -22, 12, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = INK
    c.lineWidth = 2
    c.fillStyle = '#FBD3DE'
    c.fillRect(2, -18, 8, 18)
    c.strokeRect(2, -18, 8, 18)
    c.strokeStyle = '#E0557A'
    c.lineWidth = 1.4
    c.beginPath()
    c.moveTo(2, -12)
    c.lineTo(10, -15)
    c.moveTo(2, -5)
    c.lineTo(10, -8)
    c.stroke()
    c.strokeStyle = INK
    c.fillStyle = '#F6D58E'
    c.beginPath()
    c.moveTo(6, -30)
    c.quadraticCurveTo(11, -22, 6, -20)
    c.quadraticCurveTo(1, -22, 6, -30)
    c.fill()
    c.stroke()
    c.restore()
  }
}
