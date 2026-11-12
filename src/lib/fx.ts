import confetti from 'canvas-confetti'
import gsap from 'gsap'
import { reducedMotion } from './state.svelte'

const COLORS = ['#F28AA5', '#F6D58E', '#8ED3BE', '#9CCBF0', '#C3B1F0', '#23408E']

export function burst(opts: { x?: number; y?: number; big?: boolean } = {}) {
  const count = reducedMotion ? 40 : opts.big ? 180 : 90
  void confetti({
    particleCount: count,
    spread: opts.big ? 100 : 70,
    startVelocity: opts.big ? 45 : 32,
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

/** Svelte action: tahan lama (long press). */
export function longpress(node: HTMLElement, cb: () => void) {
  let t: ReturnType<typeof setTimeout> | undefined
  let fired = false
  const start = () => {
    fired = false
    t = setTimeout(() => {
      fired = true
      cb()
    }, 650)
  }
  const cancel = () => clearTimeout(t)
  const click = (e: Event) => {
    if (fired) {
      e.stopImmediatePropagation()
      e.preventDefault()
    }
  }
  node.addEventListener('pointerdown', start)
  node.addEventListener('pointerup', cancel)
  node.addEventListener('pointerleave', cancel)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  node.addEventListener('contextmenu', (e) => e.preventDefault())
  return {
    destroy() {
      cancel()
      node.removeEventListener('pointerdown', start)
      node.removeEventListener('pointerup', cancel)
      node.removeEventListener('pointerleave', cancel)
      node.removeEventListener('pointercancel', cancel)
      node.removeEventListener('click', click, true)
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
