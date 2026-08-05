import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('Building client…');
  await build({
    root,
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
  });

  // Ensure large static grid packs ship with the client output
  for (const name of ['grid_cells_pack.json', 'grid_heat.json']) {
    const from = path.join(root, 'public', name);
    const to = path.join(root, 'dist/client', name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log(`Copied public/${name} → dist/client/${name}`);
    } else {
      console.warn(`Missing public/${name} — Blocks map may be empty`);
    }
  }

  // Rename so Vercel does not serve the empty SPA shell ahead of /api/ssr
  const indexHtml = path.join(root, 'dist/client/index.html');
  const templateHtml = path.join(root, 'dist/client/app-template.html');
  if (fs.existsSync(indexHtml)) {
    fs.renameSync(indexHtml, templateHtml);
    console.log('Moved dist/client/index.html → app-template.html (SSR template)');
  }

  console.log('Building server (SSR)…');
  await build({
    root,
    build: {
      outDir: 'dist/server',
      emptyOutDir: true,
      ssr: 'src/entry-server.tsx',
      rollupOptions: {
        output: {
          entryFileNames: 'entry-server.js',
          format: 'es',
        },
      },
    },
    ssr: {
      noExternal: true,
    },
  });

  console.log('Build complete → dist/client + dist/server');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
