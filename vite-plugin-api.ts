import type { Plugin } from 'vite';
import { config as loadEnv } from 'dotenv';

/**
 * Dev-only middleware that serves /api/dashboard and /api/cron/refresh
 * using the same handlers as Vercel serverless functions.
 */
export function dengueApiPlugin(): Plugin {
  return {
    name: 'dengue-api',
    configureServer(server) {
      loadEnv({ path: '.env.local' });
      loadEnv();

      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          if (!url.pathname.startsWith('/api/')) {
            next();
            return;
          }

          if (url.pathname === '/api/dashboard') {
            const { handleDashboardRequest } = await server.ssrLoadModule(
              '/api/dashboard.ts'
            );
            const result = await handleDashboardRequest(url);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
            return;
          }

          if (url.pathname === '/api/cron/refresh') {
            const { handleRefreshRequest } = await server.ssrLoadModule(
              '/api/cron/refresh.ts'
            );
            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers)) {
              if (typeof v === 'string') headers.set(k, v);
              else if (Array.isArray(v)) headers.set(k, v.join(','));
            }
            const result = await handleRefreshRequest(headers);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result.body));
            return;
          }

          next();
        } catch (err) {
          console.error('[dengue-api]', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'API error',
            })
          );
        }
      });
    },
  };
}
