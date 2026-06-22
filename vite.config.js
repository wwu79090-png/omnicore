import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const externalPackages = [
  'nanostores',
  'pixi-filters',
  'pixi.js',
  'three'
];

function readBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function isExternalRuntimePackage(id) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
    || id.startsWith('@pixi/');
}

export function resolveLeanCoreBuildOutDir(outDir = 'dist') {
  return path.resolve(outDir || 'dist');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';
  const buildTimestamp = new Date().toISOString();
  const banner = `/*! OmniCore | Copyright (c) 2026 杀戮 (Shalu) | QQ=3424636983 | WeChat=lookkiitylou | built=${buildTimestamp} | proof=OmniCore.Genealogy() */`;
  const sourceMapEnabled = readBoolean(env.OMNICORE_SOURCEMAP, !isProduction);
  const outputMinify = isProduction
    ? {
      compress: {
        dropConsole: true,
        dropDebugger: true
      },
      mangle: true,
      codegen: false
    }
    : false;

  const config = {
    root: '.',
    plugins: [startupBootstrapPlugin(), leanCoreBuildPlugin(isProduction)],
    define: {
      __OMNICORE_DEV__: JSON.stringify(!isProduction),
      __OMNICORE_MODE__: JSON.stringify(mode),
      __OMNICORE_SOURCEMAP__: JSON.stringify(!isProduction && sourceMapEnabled),
      __OMNICORE_DEBUG_RENDERER__: JSON.stringify(!isProduction || readBoolean(env.OMNICORE_DEBUG_RENDERER, false))
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
    build: {
      lib: {
        entry: 'src/index.js',
        name: 'OmniCore',
        formats: ['es', 'iife'],
        fileName: (format) => (format === 'iife' ? 'omnicore.iife.js' : 'omnicore.esm.js')
      },
      minify: isProduction ? 'oxc' : false,
      sourcemap: isProduction ? false : sourceMapEnabled,
      rolldownOptions: {
        external: isExternalRuntimePackage,
        output: {
          banner,
          exports: 'named',
          minify: outputMinify,
          globals: {
            nanostores: 'nanostores',
            'pixi-filters': 'PixiFilters',
            'pixi.js': 'PIXI',
            '@pixi/assets': 'PIXI',
            '@pixi/core': 'PIXI',
            '@pixi/display': 'PIXI',
            '@pixi/graphics': 'PIXI',
            '@pixi/mesh': 'PIXI',
            '@pixi/text': 'PIXI',
            three: 'THREE'
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['tests/setup.js'],
      exclude: ['node_modules/**', '**/node_modules/**', 'dist/**', '**/dist/**', 'tests/e2e/**'],
      testTimeout: 60000,
      globals: true,
      coverage: {
        provider: 'v8'
      }
    }
  };

  return config;
});

function leanCoreBuildPlugin(enabled) {
  let leanOutDir = resolveLeanCoreBuildOutDir();
  return {
    name: 'omnicore-lean-core-build',
    configResolved(config) {
      leanOutDir = resolveLeanCoreBuildOutDir(config.build?.outDir);
    },
    closeBundle() {
      if (!enabled || process.env.OMNICORE_SKIP_LEAN_BUILD === '1') return;
      const env = {
        ...process.env,
        OMNICORE_SKIP_LEAN_BUILD: '1',
        OMNICORE_LEAN_OUT_DIR: leanOutDir
      };
      const result = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx vite build --config vite.lean.config.js --mode production'], { stdio: 'inherit', env })
        : spawnSync('npx', ['vite', 'build', '--config', 'vite.lean.config.js', '--mode', 'production'], { stdio: 'inherit', env });
      if (result.status !== 0) throw new Error('Lean core build failed.');
      const coreFile = path.join(leanOutDir, 'omnicore-core.js');
      if (!existsSync(coreFile)) throw new Error(`Lean core build did not emit ${path.relative(process.cwd(), coreFile)}.`);
      const { size } = statSync(coreFile);
      console.log(`[OmniCore] lean core ESM size: ${size} bytes`);
      if (size > 40 * 1024) throw new Error('Lean core ESM exceeds 40KB budget.');
    }
  };
}

export function startupBootstrapPlugin() {
  let outDir = path.resolve('dist');
  let shouldEmitBootstrap = false;
  return {
    name: 'omnicore-startup-bootstrap',
    configResolved(config) {
      outDir = path.resolve(config.build?.outDir || 'dist');
      shouldEmitBootstrap = config.command === 'build' && process.env.VITEST !== 'true';
    },
    closeBundle() {
      if (!shouldEmitBootstrap) return;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        path.join(outDir, 'omnicore-first-frame-bootstrap.js'),
        createStartupBootstrapSource(),
        'utf8'
      );
    }
  };
}

export function createStartupBootstrapSource() {
  return `(() => {
  const marks = window.__OMNICORE_BOOT_METRICS__ || (window.__OMNICORE_BOOT_METRICS__ = []);
  const mark = (name) => {
    marks.push({ name, time: performance.now() });
    performance.mark?.(name);
  };
  mark('omnicore:first-frame-start');
  window.__OMNICORE_PRECOMPILE_GAME__ = function precompileOmniCoreGame(OmniCore) {
    if (!OmniCore?.Game) return false;
    try {
      new OmniCore.Game({ width: 1, height: 1, autoAttach: false, autoStart: false, renderer: 'canvas' });
      mark('omnicore:game-constructor-precompiled');
      return true;
    } catch {
      return false;
    }
  };
})();\n`;
}
