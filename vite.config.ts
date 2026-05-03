import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild', // esbuild e mai rapid și vine inclus cu Vite
    rollupOptions: {
      output: {
        manualChunks: {
         'vendor-react': ['react', 'react-dom', 'react-router-dom'],
         'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});