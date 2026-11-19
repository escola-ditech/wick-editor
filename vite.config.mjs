import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src');

export default defineConfig({
  // Relative base, so the build works from any folder of a site (e.g. GitHub Pages).
  base: './',

  plugins: [react()],

  resolve: {
    // Allows imports relative to src/, like 'Editor/Util/...' and 'resources/...'.
    alias: {
      Editor: path.join(src, 'Editor'),
      resources: path.join(src, 'resources'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Allows @import 'Editor/_wickbrand.scss' from any stylesheet.
        loadPaths: [src],
      },
    },
  },

  server: {
    port: 3000,
  },

  build: {
    outDir: 'build',
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
