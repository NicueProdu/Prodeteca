import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        predictions: 'predictions.html',
        ranking: 'ranking.html',
        matches: 'matches.html',
        profile: 'profile.html',
        admin: 'admin.html',
      },
    },
  },
})
