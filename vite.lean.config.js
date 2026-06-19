import { defineConfig } from 'vite';

const buildTimestamp = new Date().toISOString();
const banner = `/*! OmniCore Lean Core | author=OmniCore Open Engine Maintainers | built=${buildTimestamp} | proof=OmniCore.Genealogy() */`;

export default defineConfig({
  build: {
    outDir: process.env.OMNICORE_LEAN_OUT_DIR || 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/lean/index.js',
      name: 'OmniCoreLean',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'iife' ? 'omnicore-core.iife.js' : 'omnicore-core.js')
    },
    minify: 'oxc',
    sourcemap: false,
    rolldownOptions: {
      output: {
        exports: 'named',
        banner
      }
    }
  }
});
