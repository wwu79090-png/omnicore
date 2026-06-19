#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const target = path.resolve(args[0] || 'omnicore-plugin');
const name = valueOf('--name') || path.basename(target);

await mkdir(path.join(target, 'src'), { recursive: true });
await mkdir(path.join(target, 'demo'), { recursive: true });
await mkdir(path.join(target, 'scripts'), { recursive: true });

await writeFile(path.join(target, 'package.json'), JSON.stringify({
  name,
  version: '0.1.0',
  type: 'module',
  private: false,
  scripts: {
    dev: 'vite --host 0.0.0.0',
    build: 'vite build',
    pack: 'node scripts/pack.js',
    publish: 'npm publish --access public'
  },
  peerDependencies: {
    omnicore: '^1.0.0'
  },
  devDependencies: {
    vite: '^8.0.16'
  }
}, null, 2));

await writeFile(path.join(target, 'src/index.js'), `export default {
  name: '${name}',
  version: '0.1.0',
  init(OmniCore, context = {}) {
    this.off = OmniCore.EventBus?.prototype ? null : null;
    context.store?.set?.('${name}:enabled', true);
    context.events?.emit?.('${name}:ready', { name: '${name}' });
  },
  destroy(context = {}) {
    context.store?.set?.('${name}:enabled', false);
    this.off?.();
    this.off = null;
  }
};
`);

await writeFile(path.join(target, 'demo/index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name} demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import plugin from '../src/index.js';
      console.log('OmniCore plugin SDK demo loaded:', plugin.name);
    </script>
  </body>
</html>
`);

await writeFile(path.join(target, 'vite.config.js'), `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: '${toGlobalName(name)}',
      formats: ['es', 'iife'],
      fileName: 'index'
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
`);

await writeFile(path.join(target, 'scripts/pack.js'), `import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
mkdirSync('dist', { recursive: true });
writeFileSync(path.join('dist', 'manifest.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  entry: './index.js',
  omnicore: pkg.peerDependencies?.omnicore || '^1.0.0'
}, null, 2));
console.log('[OmniCore] plugin manifest packed.');
`);

await writeFile(path.join(target, 'README.md'), `# ${name}

独立 OmniCore 插件 SDK 项目。

## 开发

\`\`\`bash
npm install
npm run dev
\`\`\`

## 打包

\`\`\`bash
npm run build
\`\`\`

## 发布

\`\`\`bash
npm run publish
\`\`\`
`);

console.log(`[OmniCore] plugin SDK created at ${target}`);

function valueOf(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function toGlobalName(input) {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('') || 'OmniCorePlugin';
}
