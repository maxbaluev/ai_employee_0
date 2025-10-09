import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      enabled: false,
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  css: {
    postcss: null,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@supabase': path.resolve(__dirname, 'supabase'),
    },
  },
});
