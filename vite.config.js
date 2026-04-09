import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: '/login.html',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index:    'index.html',
        welcome:  'welcome.html',
        login:    'login.html',
        register: 'register.html',
        admin:    'admin.html',
      },
    },
  },
})
