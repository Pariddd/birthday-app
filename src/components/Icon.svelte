<script lang="ts">
  type Name =
    | 'back' | 'next' | 'sound' | 'mute' | 'star' | 'lock' | 'unlock' | 'mic' | 'chat' | 'joystick'
    | 'menu' | 'flip' | 'camera' | 'switch' | 'info' | 'close' | 'eye' | 'check' | 'coin' | 'download' | 'left' | 'right'
  let { name, size = 20, color = 'currentColor', stroke = 2.4 }: { name: Name; size?: number; color?: string; stroke?: number } = $props()
</script>

<svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'back'}<path d="M19 12H5M11 6l-6 6 6 6" />
  {:else if name === 'next'}<path d="M5 12h14M13 6l6 6-6 6" />
  {:else if name === 'left'}<path d="M15 5l-7 7 7 7" />
  {:else if name === 'right'}<path d="M9 5l7 7-7 7" />
  {:else if name === 'sound'}<path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  {:else if name === 'mute'}<path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9l5 6M22 9l-5 6" />
  {:else if name === 'star'}<path d="M12 2.5l2.6 6 6.4.6-4.9 4.2 1.5 6.3L12 16.3 6.4 19.6l1.5-6.3L3 9.1l6.4-.6z" fill="#F6D58E" stroke={color} />
  {:else if name === 'lock'}<rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  {:else if name === 'unlock'}<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
  {:else if name === 'mic'}<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  {:else if name === 'chat'}<path d="M4 20l1.4-4A8 8 0 1 1 8 18.6z" />
  {:else if name === 'joystick'}<rect x="3" y="12" width="18" height="8" rx="3" /><path d="M12 12V6" /><circle cx="12" cy="5" r="2.5" fill="#F28AA5" /><path d="M7 16h2M15.5 16h.5" />
  {:else if name === 'menu'}<path d="M4 5h11l5 4v10H4z" /><path d="M8 10h8M8 14h6" />
  {:else if name === 'flip'}<path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" />
  {:else if name === 'camera'}<path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" />
  {:else if name === 'switch'}<path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" />
  {:else if name === 'info'}<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />
  {:else if name === 'close'}<path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'eye'}<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  {:else if name === 'check'}<path d="M5 12l5 5 9-10" />
  {:else if name === 'download'}<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  {:else if name === 'coin'}<circle cx="12" cy="12" r="9" fill="#F6D58E" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
  {/if}
</svg>
