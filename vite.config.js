import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/wimp3/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: mode === 'production' ? 'https://wimp3-production.up.railway.app'  : 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
      output: {
        manualChunks: {
          vendor: ['jquery']
        }
      },
      plugins: [{
        name: 'minify-html',
        generateBundle(_, b) {
          for (const f in b) {
            if (f.endsWith('.html') && b[f].type === 'asset') {
              b[f].source = b[f].source
                .replace(/\n\s*/g, '')
                .replace(/>\s+</g, '><')
                .replace(/\s{2,}/g, ' ')
                .replace(/<!--.*?-->/g, '')
                .trim();
            }
          }
        }
      }]
    }
  },
  publicDir: 'public'
}));