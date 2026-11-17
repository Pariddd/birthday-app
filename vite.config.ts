import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Saat `npm run dev`, jalankan fungsi di folder api/ langsung di server Vite
// (di Vercel, tiap file api/*.ts otomatis jadi Vercel Function — plugin ini tidak ikut ter-deploy).
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server) {
      // Variabel non-VITE_ (rahasia server) dari .env / .env.local → process.env, hanya di dev.
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [k, v] of Object.entries(env)) if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v

      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z]+)(?:[?#]|$)/)
        if (!m) return next()
        const file = path.join(process.cwd(), 'api', `${m[1]}.ts`)
        if (!existsSync(file)) {
          res.statusCode = 404
          return res.end('{"error":"not found"}')
        }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
          const method = req.method || 'GET'
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const mod = (await server.ssrLoadModule(`/api/${m[1]}.ts`)) as { default: (r: Request) => Promise<Response> }
          const r = await mod.default(request)
          res.statusCode = r.status
          r.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          console.error(e)
          res.statusCode = 500
          res.end('{"error":"dev server error"}')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), apiDev()],
})
