#!/usr/bin/env node
// Production build script using esbuild directly.
// Replaces `vite build` which hangs on Node 25 / macOS 26 due to rollup 4.60.x infinite recursion.
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
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
// Replacing the whole `import.meta.env` at once (rather than individual keys)
// avoids esbuild hangs caused by complex expression matching on nested accessors.
const isDev = process.env.NODE_ENV === 'development';
const envObj = {
  MODE: isDev ? 'development' : 'production',
  DEV: isDev,
  PROD: !isDev,
  SSR: false,
};
// .env file vars (only VITE_* are exposed to the client, same as Vite)
for (const [key, val] of Object.entries(envVars)) {
  if (key.startsWith('VITE_')) envObj[key] = process.env[key] ?? val;
}
// Shell env vars override .env file
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
// Strategy: temporarily overwrite src/index.css with the compiled output, then restore.
console.log('Processing Tailwind CSS...');
const indexCssPath = resolve(root, 'src/index.css');
const rawCss = readFileSync(indexCssPath, 'utf8');
// chdir to the meeting-lab root so Tailwind content globs ("./src/**") resolve correctly
const origCwd = process.cwd();
process.chdir(root);
const postcssResult = await postcss([
  tailwindcss({ config: resolve(root, 'tailwind.config.ts') }),
  autoprefixer,
]).process(rawCss, { from: indexCssPath });
process.chdir(origCwd);
// Temporarily replace src/index.css with compiled CSS so esbuild picks it up
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
    // Use 'css' (global, not 'local-css') so Tailwind utility classes are not scoped
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
  // Always restore the original src/index.css with Tailwind directives
  writeFileSync(indexCssPath, rawCss);
}

// Find output file names from esbuild metadata
const outputs = Object.keys(result.metafile.outputs);
const jsEntry  = outputs.find(f => f.includes('main-') && f.endsWith('.js') && !f.endsWith('.map'));
const cssEntry = outputs.find(f => f.endsWith('.css') && !f.endsWith('.map'));

// Use basename so paths are always /assets/<file> regardless of CWD during build
import { basename } from 'path';
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
