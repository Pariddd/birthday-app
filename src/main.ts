import { mount } from 'svelte'
// Font di-host sendiri (tidak bergantung ke Google Fonts, lebih cepat & tetap jalan di jaringan lambat)
import '@fontsource/caveat/latin-500.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/nunito/latin-900.css'
import './app.css'
import App from './App.svelte'
import { game, SCENES, type SceneId } from './lib/state.svelte'

// Deep link dari notifikasi / app layar utama: ?buka=kotak | kenangan | kapsul | lari | arcade
function buka(id: string | null) {
  if (!id || id === 'kunci' || !SCENES.some((s) => s.id === id)) return
  if (game.unlocked) game.go(id as SceneId)
  else game.pendingBuka = id as SceneId // tunggu kunci tanggal lahir dibuka dulu
}
const q = new URLSearchParams(location.search)
if (q.has('buka')) {
  buka(q.get('buka'))
  q.delete('buka')
  history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : '') + location.hash)
}

// Service worker hanya untuk Web Push (tidak meng-cache apa pun, jadi aman juga saat dev).
if ('serviceWorker' in navigator && isSecureContext) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent<{ type?: string; scene?: string }>) => {
    if (e.data?.type === 'buka') buka(e.data.scene ?? null)
  })
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
