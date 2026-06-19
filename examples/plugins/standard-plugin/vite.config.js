import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'OmniCoreStandardPlugin',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'iife' ? 'standard-plugin.iife.js' : 'standard-plugin.js')
    },
    rollupOptions: {
      external: ['omnicore'],
      output: {
        globals: {
          omnicore: 'OmniCore'
        }
      }
    }
  }
});
