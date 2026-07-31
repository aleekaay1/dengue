import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildDashboard } from '../lib/buildDashboard.js';
import { sendJson } from './_http.js';

function serializeForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildJsonLd(payload: Awaited<ReturnType<typeof buildDashboard>>): string {
  const zones = [...payload.zones].sort((a, b) => b.riskScore - a.riskScore);
  return serializeForScript({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Dengue risk surveillance — ${payload.cityConditions.cityName}`,
    description:
      'Adult Aedes biting activity risk scores for Islamabad Capital Territory urban and rural zones.',
    dateModified: payload.builtAt,
    spatialCoverage: {
      '@type': 'Place',
      name: 'Islamabad Capital Territory, Pakistan',
    },
    variableMeasured: zones.slice(0, 19).map((z) => ({
      '@type': 'PropertyValue',
      name: `${z.name} risk score`,
      value: z.riskScore,
      unitText: 'score_0_100',
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'tehsil', value: z.tehsil },
        { '@type': 'PropertyValue', name: 'areaType', value: z.areaType },
        { '@type': 'PropertyValue', name: 'riskLevel', value: z.riskLevel },
        {
          '@type': 'PropertyValue',
          name: 'temperature_C',
          value: z.temperature,
        },
        { '@type': 'PropertyValue', name: 'humidity_pct', value: z.humidity },
        { '@type': 'PropertyValue', name: 'ndvi', value: z.vegetationIndex },
      ],
    })),
  });
}

/**
 * SSR entry for the SPA shell — returns HTML with live dashboard data so
 * crawlers / AI agents can read zone scores without running client JS.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const clientDir = path.join(process.cwd(), 'dist', 'client');
    const templatePath = path.join(clientDir, 'app-template.html');
    const serverEntry = path.join(
      process.cwd(),
      'dist',
      'server',
      'entry-server.js'
    );

    if (!fs.existsSync(templatePath) || !fs.existsSync(serverEntry)) {
      sendJson(res, 500, {
        error:
          'SSR bundles missing — run npm run build (client + server) before deploy',
      });
      return;
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    const { render } = (await import(pathToFileURL(serverEntry).href)) as {
      render: (data: unknown) => { html: string };
    };

    const built = await buildDashboard();
    const initialData = {
      ...built,
      mode: 'live-build' as const,
    };

    const { html } = render(initialData);
    const jsonLd = buildJsonLd(built);
    const head = `<script type="application/ld+json">${jsonLd}</script>`;
    const initialScript = `<script>window.__INITIAL_DATA__=${serializeForScript(initialData)};</script>`;

    const page = template
      .replace('<!--app-head-->', head)
      .replace('<!--app-html-->', html)
      .replace('<!--initial-data-->', initialScript);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(page);
  } catch (err) {
    console.error('[api/ssr]', err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'SSR failed',
    });
  }
}
