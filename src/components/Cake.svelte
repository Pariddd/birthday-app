<script lang="ts" module>
  export const CRAYONS = {
    pink: { soft: '#FBD3DE', line: '#F28AA5', label: 'pink' },
    butter: { soft: '#FFF0B3', line: '#F6D58E', label: 'kuning' },
    mint: { soft: '#E3F4EE', line: '#8ED3BE', label: 'mint' },
    sky: { soft: '#DCEEFB', line: '#9CCBF0', label: 'biru langit' },
    lilac: { soft: '#ECE4FF', line: '#C3B1F0', label: 'ungu' },
    cocoa: { soft: '#EBD9C8', line: '#B98863', label: 'cokelat' },
  } as const
  export type CrayonKey = keyof typeof CRAYONS
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { CakeArea, CakeColors } from '../lib/state.svelte'
  import { draw as drawAction } from '../lib/fx'

  let {
    colors,
    interactive = false,
    onpaint,
    viewBox = '0 0 300 260',
    label = 'Kue ulang tahun',
    drawIn = false,
    children,
  }: {
    colors: CakeColors
    interactive?: boolean
    onpaint?: (a: CakeArea) => void
    viewBox?: string
    label?: string
    drawIn?: boolean
    children?: Snippet
  } = $props()

  const uid = 'c' + Math.random().toString(36).slice(2, 8)

  const AREAS: { id: CakeArea; nama: string }[] = [
    { id: 'alas', nama: 'alas kue' },
    { id: 'bawah', nama: 'badan bawah' },
    { id: 'atas', nama: 'badan atas' },
    { id: 'krim', nama: 'krim' },
    { id: 'stroberi', nama: 'stroberi' },
  ]

  function fill(a: CakeArea) {
    const c = colors[a] as CrayonKey | undefined
    if (!c) return interactive ? `url(#${uid}-hatch)` : a === 'stroberi' ? '#F28AA5' : '#FFFFFF'
    if (a === 'stroberi') return CRAYONS[c].line
    return `url(#${uid}-${c})`
  }

  function areaAttrs(a: CakeArea) {
    if (!interactive) return {}
    return {
      role: 'button',
      tabindex: 0,
      'aria-label': `Warnai ${AREAS.find((x) => x.id === a)?.nama}`,
      style: 'cursor:pointer',
    }
  }

  function key(e: KeyboardEvent, a: CakeArea) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onpaint?.(a)
    }
  }

  function noop(_n: SVGSVGElement, _p?: unknown) {
    return {}
  }
  const maybeDraw = drawIn ? drawAction : noop
</script>

<svg role="img" aria-label={label} {viewBox} fill="none" stroke="#23408E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="cake" use:maybeDraw={{ duration: 1.3 }}>
  <defs>
    <pattern id="{uid}-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#FFFFFF" stroke="none" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#B4BED8" stroke-width="1.2" />
    </pattern>
    {#each Object.entries(CRAYONS) as [k, c] (k)}
      <pattern id="{uid}-{k}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <rect width="5" height="5" fill={c.soft} stroke="none" />
        <line x1="0" y1="0" x2="0" y2="5" stroke={c.line} stroke-width="1.6" stroke-opacity="0.75" />
      </pattern>
    {/each}
  </defs>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g>
    <ellipse cx="150" cy="232" rx="134" ry="18" fill={fill('alas')} {...areaAttrs('alas')} onclick={() => interactive && onpaint?.('alas')} onkeydown={(e) => key(e, 'alas')} />
    <ellipse cx="150" cy="234" rx="128" ry="14" stroke-opacity="0.3" stroke-width="1.4" pointer-events="none" />
    <path d="M44 150 C66 160 84 142 106 152 C128 162 148 142 170 152 C192 162 212 144 256 150 L256 214 C256 234 44 234 44 214 Z" fill={fill('bawah')} {...areaAttrs('bawah')} onclick={() => interactive && onpaint?.('bawah')} onkeydown={(e) => key(e, 'bawah')} />
    <path d="M44 104 L256 104 L256 150 C212 144 192 162 170 152 C148 142 128 162 106 152 C84 142 66 160 44 150 Z" fill={fill('atas')} {...areaAttrs('atas')} onclick={() => interactive && onpaint?.('atas')} onkeydown={(e) => key(e, 'atas')} />
    <g {...areaAttrs('krim')} onclick={() => interactive && onpaint?.('krim')} onkeydown={(e) => key(e, 'krim')}>
      <path d="M44 104 C44 122 52 130 58 120 C63 112 66 136 76 132 C86 128 84 114 94 122 C104 132 108 140 118 130 C126 122 128 116 136 124 C146 134 152 142 160 128 C166 118 172 120 180 130 C188 140 196 136 200 122 C204 112 210 118 216 128 C222 138 232 136 236 124 C240 114 246 118 250 126 C254 132 256 120 256 104" fill={fill('krim')} />
      <ellipse cx="150" cy="104" rx="106" ry="22" fill={fill('krim')} />
      <ellipse cx="151" cy="102" rx="100" ry="18" stroke-opacity="0.3" stroke-width="1.3" />
    </g>
    <g {...areaAttrs('stroberi')} onclick={() => interactive && onpaint?.('stroberi')} onkeydown={(e) => key(e, 'stroberi')}>
      <path d="M70 104 C64 94 74 88 78 96 C82 88 92 94 86 104 L78 112 Z" fill={fill('stroberi')} />
      <path d="M214 106 C208 96 218 90 222 98 C226 90 236 96 230 106 L222 114 Z" fill={fill('stroberi')} />
      <path d="M76 92 l2 -6 M220 94 l2 -6" stroke="#5DB7A5" stroke-width="2.4" />
    </g>
  </g>
  {@render children?.()}
</svg>

<style>
  .cake {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    touch-action: manipulation;
  }
  .cake :global([role='button']:focus-visible) {
    outline: none;
    stroke: #c93d66;
    stroke-width: 4;
  }
</style>
