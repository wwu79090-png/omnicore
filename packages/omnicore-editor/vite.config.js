import { defineConfig } from 'vite';

const desktopChunkGroups = [
  {
    name: 'vendor-three',
    test: /node_modules[\\/]three(?:[\\/]|$)/,
    priority: 40,
    maxSize: 450000
  },
  {
    name: 'vendor-pixi',
    test: /node_modules[\\/](?:pixi\.js|@pixi|pixi-filters|@esotericsoftware[\\/]spine-pixi)(?:[\\/]|$)/,
    priority: 35,
    maxSize: 450000
  },
  {
    name: 'omnicore-runtime',
    test: /[\\/]dist[\\/](?:omnicore\.esm|dist-[^\\/]+)\.js$/,
    priority: 30,
    maxSize: 450000
  },
  {
    name: 'editor-workbench',
    test: /[\\/]packages[\\/]omnicore-editor[\\/]src[\\/]/,
    priority: 10,
    minSize: 100000,
    maxSize: 450000
  },
  {
    name: 'vendor-shared',
    test: /node_modules/,
    priority: 5,
    minSize: 100000,
    maxSize: 450000
  }
];

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: desktopChunkGroups
        }
      }
    }
  }
});
