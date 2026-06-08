import { defineConfig } from 'vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Solo dev: emula el `cleanUrls` de Vercel (/login -> /login.html).
// Vercel lo ignora en prod (usa su propio cleanUrls de vercel.json).
function cleanUrls() {
  return {
    name: 'clean-urls-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url.split('?')[0]
        if (url !== '/' && !url.includes('.') && existsSync(resolve(`.${url}.html`))) {
          req.url = `${url}.html${req.url.slice(url.length)}`
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [cleanUrls()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        predictions: 'predictions.html',
        ranking: 'ranking.html',
        'ranking-area': 'ranking-area.html',
        matches: 'matches.html',
        profile: 'profile.html',
        admin: 'admin.html',
      },
    },
  },
})
