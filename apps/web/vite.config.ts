import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const compatAliases = {
  react: 'preact/compat',
  'react-dom': 'preact/compat',
  'react-dom/test-utils': 'preact/test-utils',
  'react/jsx-runtime': 'preact/jsx-runtime',
  'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
};

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: {
      ...compatAliases,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  appType: 'spa',
  server: {
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: false,
        ws: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
