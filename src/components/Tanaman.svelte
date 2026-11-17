<script lang="ts">
  // Tanaman "Taman Kita": 0 tanah kosong · 1 biji · 2 tunas · 3 kuncup · 4 mekar
  // 5 semak bunga · 6 pohon berbunga · 7 pohon legendaris (lampu & bintang).
  let { tahap, size = 220, diam = false }: { tahap: number; size?: number; diam?: boolean } = $props()
  const t = $derived(Math.max(0, Math.min(7, tahap)))
  const INK = '#23408E'
</script>

<svg
  class="tanaman"
  class:sway={!diam && t >= 2}
  width={size}
  height={size * 1.1}
  viewBox="0 0 200 220"
  fill="none"
  stroke={INK}
  stroke-width="2.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  role="img"
  aria-label="Tanaman tahap {t}"
>
  <!-- cahaya legendaris -->
  {#if t === 7}
    <circle cx="100" cy="92" r="88" fill="#FFF4CC" stroke="none" opacity="0.9" />
    <circle cx="100" cy="92" r="70" fill="#FFE9A8" stroke="none" opacity="0.6" />
  {/if}

  <g class="plant">
    {#if t === 1}
      <!-- biji + tunas mungil -->
      <ellipse cx="100" cy="157" rx="11" ry="7" fill="#C9A27E" />
      <path d="M96 155 c2 -3 6 -3 8 0" stroke-width="1.6" />
      <path d="M100 151 C100 142 103 136 110 134" />
      <path d="M110 134 C110 126 118 122 124 124 C122 132 116 136 110 134 Z" fill="#8ED3BE" stroke-width="2" />
    {:else if t === 2}
      <!-- tunas -->
      <path d="M100 170 C100 150 98 138 100 126" />
      <path d="M100 146 C88 146 80 138 80 128 C92 128 100 134 100 146 Z" fill="#8ED3BE" />
      <path d="M100 136 C112 136 120 128 120 118 C108 118 100 124 100 136 Z" fill="#B7E6D6" />
    {:else if t === 3}
      <!-- kuncup -->
      <path d="M100 170 C102 140 98 110 100 86" />
      <path d="M100 150 C86 150 76 140 76 128 C90 128 100 136 100 150 Z" fill="#8ED3BE" />
      <path d="M100 132 C114 132 124 122 124 110 C110 110 100 118 100 132 Z" fill="#B7E6D6" />
      <path d="M100 116 C90 116 84 108 84 100 C94 100 100 106 100 116 Z" fill="#8ED3BE" />
      <path d="M100 86 C90 80 90 64 100 54 C110 64 110 80 100 86 Z" fill="#F28AA5" />
      <path d="M100 86 L94 78 M100 86 L106 78" stroke-width="2" />
    {:else if t === 4}
      <!-- mekar -->
      <path d="M100 170 C102 140 98 110 100 84" />
      <path d="M100 150 C86 150 76 140 76 128 C90 128 100 136 100 150 Z" fill="#8ED3BE" />
      <path d="M100 130 C114 130 124 120 124 108 C110 108 100 116 100 130 Z" fill="#B7E6D6" />
      <path d="M100 120 C112 112 120 112 128 104" stroke-width="2.2" />
      <path d="M128 104 C122 98 124 88 130 84 C136 88 136 98 128 104 Z" fill="#FBD3DE" stroke-width="2" />
      {#each [0, 72, 144, 216, 288] as a (a)}
        <ellipse cx="100" cy="58" rx="11" ry="17" fill="#F28AA5" transform="rotate({a} 100 72)" />
      {/each}
      <circle cx="100" cy="72" r="9" fill="#F6D58E" />
    {:else if t === 5}
      <!-- semak bunga: tiga tangkai -->
      <path d="M100 170 C98 140 90 110 72 86" />
      <path d="M100 170 C102 136 100 104 102 70" />
      <path d="M100 170 C104 140 116 112 132 92" />
      {#each [[80, 150, -1], [120, 146, 1], [86, 120, -1], [118, 116, 1], [100, 136, -1]] as [x, y, d], i (i)}
        <path d="M{x} {y} c{d * 14} 0 {d * 22} -8 {d * 22} -18 c{d * -14} 0 {d * -22} 6 {d * -22} 18 Z" fill={i % 2 ? '#B7E6D6' : '#8ED3BE'} />
      {/each}
      {#each [{ x: 72, y: 74, c: '#F28AA5' }, { x: 102, y: 56, c: '#C3B1F0' }, { x: 134, y: 80, c: '#F6D58E' }] as { x, y, c }, i (i)}
        {#each [0, 72, 144, 216, 288] as a (a)}
          <ellipse cx={x} cy={y - 11} rx="7" ry="11" fill={c} transform="rotate({a} {x} {y})" />
        {/each}
        <circle cx={x} cy={y} r="6" fill={i === 2 ? '#F28AA5' : '#F6D58E'} />
      {/each}
    {:else if t >= 6}
      <!-- pohon -->
      <path d="M92 172 C94 150 92 130 86 112 M108 172 C106 150 108 130 114 112" fill="none" stroke-width="3" />
      <path d="M92 172 C94 150 92 130 86 112 L114 112 C108 130 106 150 108 172 Z" fill="#C9A27E" stroke="none" />
      <path d="M92 172 C94 150 92 130 86 112 M108 172 C106 150 108 130 114 112" />
      <path d="M100 130 C90 120 80 118 70 110 M102 124 C112 116 124 112 132 102" stroke-width="2.4" />
      <path
        d="M100 26 C128 24 150 40 154 62 C172 70 176 98 160 112 C156 130 132 138 116 130 C106 140 86 140 78 130 C58 134 40 120 42 102 C28 90 34 66 52 62 C56 40 76 26 100 26 Z"
        fill={t === 7 ? '#9FDCC6' : '#B7E6D6'}
      />
      <path d="M62 84 C70 78 80 80 86 86 M110 60 C120 54 132 58 136 66 M118 104 C126 98 138 100 142 106" stroke-width="2" />
      {#each [[64, 70], [92, 46], [124, 40], [146, 76], [150, 104], [118, 120], [84, 118], [56, 104], [102, 80], [80, 94], [132, 92]] as [x, y], i (i)}
        <circle cx={x} cy={y} r={i % 3 ? 5 : 6.5} fill={i % 4 === 0 ? '#F6D58E' : i % 2 ? '#F28AA5' : '#FFC9D9'} stroke-width="1.8" />
      {/each}
      <!-- kelopak berjatuhan -->
      <path class="petal p1" d="M150 140 c4 -2 8 0 8 4 c-4 2 -8 0 -8 -4 Z" fill="#FFC9D9" stroke-width="1.4" />
      <path class="petal p2" d="M48 150 c4 -2 8 0 8 4 c-4 2 -8 0 -8 -4 Z" fill="#F28AA5" stroke-width="1.4" />
      {#if t === 7}
        <!-- untaian lampu -->
        <path d="M50 92 C80 116 120 116 152 90" stroke="#B98A2A" stroke-width="1.6" stroke-dasharray="2 4" />
        {#each [[58, 99], [74, 107], [92, 112], [110, 112], [128, 107], [144, 98]] as [x, y], i (i)}
          <circle class="lamp l{i % 3}" cx={x} cy={y} r="4.5" fill="#FFE27A" stroke="#B98A2A" stroke-width="1.6" />
        {/each}
      {/if}
    {/if}
  </g>

  <!-- kupu-kupu (semak ke atas) -->
  {#if t >= 5}
    <g class="fly f1" stroke-width="1.8">
      <path d="M160 46 c-8 -10 -16 -4 -12 4 c4 6 12 2 12 -4 Z" fill="#C3B1F0" />
      <path d="M160 46 c8 -10 16 -4 12 4 c-4 6 -12 2 -12 -4 Z" fill="#9CCBF0" />
      <path d="M160 40 v12" />
    </g>
  {/if}
  {#if t >= 6}
    <g class="fly f2" stroke-width="1.8">
      <path d="M36 52 c-7 -9 -14 -4 -11 3 c4 6 11 2 11 -3 Z" fill="#FBD3DE" />
      <path d="M36 52 c7 -9 14 -4 11 3 c-4 6 -11 2 -11 -3 Z" fill="#F6D58E" />
      <path d="M36 47 v10" />
    </g>
  {/if}
  {#if t === 7}
    {#each [[30, 24, 1.1], [172, 20, 0.9], [182, 124, 0.7], [18, 120, 0.8], [100, 6, 0.8]] as [x, y, s], i (i)}
      <path class="twinkle tw{i % 3}" d="M{x} {y - 9 * s} C{x + 1 * s} {y - 2 * s} {x + 2 * s} {y - 1 * s} {x + 9 * s} {y} C{x + 2 * s} {y + 1 * s} {x + 1 * s} {y + 2 * s} {x} {y + 9 * s} C{x - 1 * s} {y + 2 * s} {x - 2 * s} {y + 1 * s} {x - 9 * s} {y} C{x - 2 * s} {y - 1 * s} {x - 1 * s} {y - 2 * s} {x} {y - 9 * s} Z" fill="#F6D58E" stroke-width="1.4" />
    {/each}
  {/if}

  <!-- pot -->
  <path d="M58 170 H142 L134 210 H66 Z" fill={t === 7 ? '#F6D58E' : t >= 4 ? '#F28AA5' : '#FBD3DE'} />
  <path d="M54 162 H146 V172 H54 Z" fill={t === 7 ? '#F2B84B' : t >= 4 ? '#E0557A' : '#F28AA5'} />
  <ellipse cx="100" cy="164" rx="40" ry="5" fill="#8a6b55" stroke="none" opacity="0.55" />
  {#if t >= 4}<path d="M84 188 c4 -6 12 -6 16 0 c4 -6 12 -6 16 0 c0 8 -16 14 -16 14 s-16 -6 -16 -14 Z" fill="#FFF" stroke-width="1.8" />{/if}
  {#if t === 0}
    <text x="100" y="146" text-anchor="middle" font-family="Caveat, cursive" font-size="20" fill={INK} stroke="none">siram berdua ya</text>
  {/if}
</svg>

<style>
  .tanaman {
    overflow: visible;
    display: block;
  }
  .sway .plant {
    transform-origin: 100px 170px;
    animation: sway 4.5s ease-in-out infinite;
  }
  @keyframes sway {
    0%,
    100% {
      rotate: -1.4deg;
    }
    50% {
      rotate: 1.4deg;
    }
  }
  .fly {
    animation: fly 3.4s ease-in-out infinite;
  }
  .f2 {
    animation-delay: -1.6s;
  }
  @keyframes fly {
    0%,
    100% {
      translate: 0 0;
    }
    50% {
      translate: -6px -8px;
    }
  }
  .petal {
    animation: fall 5s linear infinite;
  }
  .p2 {
    animation-delay: -2.5s;
  }
  @keyframes fall {
    0% {
      translate: 0 -40px;
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      translate: -10px 30px;
      opacity: 0;
    }
  }
  .lamp {
    animation: glow 1.8s ease-in-out infinite;
  }
  .l1 {
    animation-delay: -0.6s;
  }
  .l2 {
    animation-delay: -1.2s;
  }
  @keyframes glow {
    50% {
      fill: #fff8d6;
    }
  }
  .twinkle {
    transform-box: fill-box;
    transform-origin: center;
    animation: tw 2.2s ease-in-out infinite;
  }
  .tw1 {
    animation-delay: -0.7s;
  }
  .tw2 {
    animation-delay: -1.4s;
  }
  @keyframes tw {
    50% {
      scale: 0.6;
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .plant,
    .fly,
    .petal,
    .lamp,
    .twinkle {
      animation: none !important;
    }
  }
</style>
