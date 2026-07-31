import type { VercelResponse } from '@vercel/node';

/** Works on classic and Rust Node runtimes (no res.json dependency). */
export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
