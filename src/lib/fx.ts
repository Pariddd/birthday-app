import confetti from 'canvas-confetti'
import gsap from 'gsap'
import { reducedMotion } from './state.svelte'

const COLORS = ['#F28AA5', '#F6D58E', '#8ED3BE', '#9CCBF0', '#C3B1F0', '#23408E']

export function burst(opts: { x?: number; y?: number; big?: boolean; small?: boolean } = {}) {
  const count = reducedMotion ? 40 : opts.big ? 180 : opts.small ? 14 : 90
  void confetti({
    particleCount: count,
    spread: opts.big ? 100 : opts.small ? 50 : 70,
    startVelocity: opts.big ? 45 : opts.small ? 16 : 32,
    origin: { x: opts.x ?? 0.5, y: opts.y ?? 0.55 },
    colors: COLORS,
    scalar: 0.9,
    disableForReducedMotion: false,
  })
}

/** Svelte action: garis SVG "menggambar dirinya sendiri". */
export function draw(node: SVGSVGElement, params: { delay?: number; duration?: number } = {}) {
  if (reducedMotion) return
  const els = Array.from(node.querySelectorAll<SVGGeometryElement>('path, ellipse, circle, rect, line, polyline'))
  const targets = els.filter((el) => {
    const cs = getComputedStyle(el)
    return cs.stroke !== 'none' && !el.getAttribute('stroke-dasharray') && !el.closest('[data-nodraw]')
  })
  const fills = els.filter((el) => !el.closest('[data-nodraw]'))
  const tl = gsap.timeline({ delay: params.delay ?? 0.1 })
  targets.forEach((el) => {
    let len = 0
    try {
      len = el.getTotalLength()
    } catch {
      return
    }
    if (!len) return
    el.style.strokeDasharray = `${len}`
    el.style.strokeDashoffset = `${len}`
  })
  fills.forEach((el) => (el.style.fillOpacity = '0'))
  tl.to(targets, {
    strokeDashoffset: 0,
    duration: params.duration ?? 1.1,
    ease: 'power1.inOut',
    stagger: 0.04,
    onComplete: () => targets.forEach((el) => (el.style.strokeDasharray = '')),
  })
  tl.to(fills, { fillOpacity: 1, duration: 0.5, stagger: 0.02, clearProps: 'fillOpacity' }, '-=0.6')
  return { destroy: () => tl.kill() }
}

/**
 * Svelte action: tahan lama (long press).
 * - Toleransi geser 14px: jari di HP hampir selalu bergeser sedikit saat ditahan,
 *   jadi tidak dibatalkan oleh pointerleave/gerakan kecil.
 * - Selama ditahan, elemen diberi class `pressing` (untuk umpan balik visual).
 * - pointercancel tetap membatalkan: itu tanda browser mengambil alih untuk scroll.
 */
export function longpress(node: HTMLElement, cb: () => void) {
  const HOLD = 550
  let t: ReturnType<typeof setTimeout> | undefined
  let fired = false
  let sx = 0
  let sy = 0
  const cancel = () => {
    clearTimeout(t)
    node.classList.remove('pressing')
  }
  const start = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    fired = false
    sx = e.clientX
    sy = e.clientY
    node.classList.add('pressing')
    t = setTimeout(() => {
      fired = true
      node.classList.remove('pressing')
      vibrate(40)
      cb()
    }, HOLD)
  }
  const move = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 14) cancel()
  }
  const click = (e: Event) => {
    if (fired) {
      fired = false
      e.stopImmediatePropagation()
      e.preventDefault()
    }
  }
  const noMenu = (e: Event) => e.preventDefault()
  node.addEventListener('pointerdown', start)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', cancel)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  node.addEventListener('contextmenu', noMenu)
  return {
    destroy() {
      cancel()
      node.removeEventListener('pointerdown', start)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', cancel)
      node.removeEventListener('pointercancel', cancel)
      node.removeEventListener('click', click, true)
      node.removeEventListener('contextmenu', noMenu)
    },
  }
}

export function vibrate(ms = 20) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* iOS tidak mendukung — abaikan */
  }
}
