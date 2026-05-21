#!/usr/bin/env node
// Production build script using esbuild directly.
// Replaces `vite build` which hangs on Node 25 / macOS 26 due to rollup 4.60.x infinite recursion.
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const outdir = resolve(root, 'dist/assets');

// Load .env file (Vite does this automatically; esbuild does not)
function loadEnv(dir) {
  const envPath = resolve(dir, '.env');
  const envLocalPath = resolve(dir, '.env.local');
  const env = {};
  for (const p of [envPath, envLocalPath]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

const envVars = loadEnv(root);

// Build the import.meta.env replacement object.
const isDev = process.env.NODE_ENV === 'development';
const envObj = {
  MODE: isDev ? 'development' : 'production',
  DEV: isDev,
  PROD: !isDev,
  SSR: false,
};
for (const [key, val] of Object.entries(envVars)) {
  if (key.startsWith('VITE_')) envObj[key] = process.env[key] ?? val;
}
for (const [key, val] of Object.entries(process.env)) {
  if (key.startsWith('VITE_')) envObj[key] = val;
}

const define = { 'import.meta.env': JSON.stringify(envObj) };

console.log('Build-time import.meta.env:');
for (const [k, v] of Object.entries(envObj)) {
  if (k.startsWith('VITE_') || k === 'MODE') console.log(' ', k, '=', JSON.stringify(v));
}

rmSync(resolve(root, 'dist'), { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// Pre-process Tailwind CSS through PostCSS before passing to esbuild.
// esbuild does not run PostCSS plugins, so @tailwind directives must be compiled first.
//
// NOTE: We pass the Tailwind config as an inline object rather than pointing to
// tailwind.config.ts. This avoids jiti (the TS loader used by Tailwind) which
// hangs indefinitely on Node 25 / macOS 26 ARM64 when loading .ts config files.
// Keep this object in sync with tailwind.config.ts.
const tailwindConfig = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          300: '#d478dc',
          400: '#c355cb',
          500: '#AD38B5',
          600: '#8f2c96',
          700: '#6e2174',
        },
        vista: {
          bg: '#0a0a0a',
          surface: '#141414',
          raised: '#1e1e1e',
          elevated: '#262626',
          border: '#2a2a2a',
          muted: '#666666',
        },
      },
    },
  },
  plugins: [],
};

console.log('Processing Tailwind CSS...');
const indexCssPath = resolve(root, 'src/index.css');
const rawCss = readFileSync(indexCssPath, 'utf8');
const origCwd = process.cwd();
process.chdir(root);
const postcssResult = await postcss([
  tailwindcss(tailwindConfig),
  autoprefixer,
]).process(rawCss, { from: indexCssPath });
process.chdir(origCwd);
writeFileSync(indexCssPath, postcssResult.css);
console.log(`Tailwind compiled: ${postcssResult.css.length} bytes`);

let result;
try {
  result = await esbuild.build({
    entryPoints: [resolve(root, 'src/main.tsx')],
    bundle: true,
    outdir,
    format: 'esm',
    splitting: true,
    jsx: 'automatic',
    loader: { '.css': 'css' },
    minify: true,
    sourcemap: true,
    entryNames: '[name]-[hash]',
    chunkNames: '[name]-[hash]',
    assetNames: '[name]-[hash]',
    define,
    alias: {
      '@meet-vista/core':          resolve(root, '../../packages/core/src/index.ts'),
      '@meet-vista/meeting-core':  resolve(root, '../../packages/meeting-core/src/index.ts'),
      '@meet-vista/presence-core': resolve(root, '../../packages/presence-core/src/index.ts'),
    },
    metafile: true,
  });
} finally {
  writeFileSync(indexCssPath, rawCss);
}

const outputs = Object.keys(result.metafile.outputs);
const jsEntry  = outputs.find(f => f.includes('main-') && f.endsWith('.js') && !f.endsWith('.map'));
const cssEntry = outputs.find(f => f.endsWith('.css') && !f.endsWith('.map'));

const jsFile  = jsEntry  ? '/assets/' + basename(jsEntry)  : '/assets/main.js';
const cssFile = cssEntry ? '/assets/' + basename(cssEntry) : null;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vista Meet — Meeting Lab</title>
    ${cssFile ? `<link rel="stylesheet" href="${cssFile}" />` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${jsFile}"></script>
  </body>
</html>`;

writeFileSync(resolve(root, 'dist/index.html'), html);

const sizes = outputs
  .filter(f => !f.endsWith('.map'))
  .map(f => `  ${f.replace('dist/', '')}`)
  .join('\n');
console.log(`✓ Build complete\n${sizes}`);
