/**
 * Single entry point for /api/*, shared by the Cloudflare Pages Function
 * (functions/api/[[route]].ts) and the local Express server (server.ts).
 * Workers-safe: nothing imported here may depend on Node.
 */
import { assertSameOrigin, errorResponse, HttpError, json, type Env } from './http';
import { handleAccountRoutes } from './auth/accountRoutes';
import { handleNewsletterRoutes } from './newsletter/newsletterRoutes';
import { handleCatalogRoutes } from './catalog/catalogRoutes';

export type { Env } from './http';

const HANDLERS = [handleCatalogRoutes, handleAccountRoutes, handleNewsletterRoutes];

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (!env?.DB) {
      return errorResponse(503, 'The database isn’t connected. Check the D1 binding named "DB".');
    }
    if (url.pathname === '/api/health') return json({ ok: true });
    // One-click unsubscribe POSTs come from mail providers, not our pages.
    if (!url.pathname.startsWith('/api/newsletter/unsubscribe')) assertSameOrigin(request);

    for (const handler of HANDLERS) {
      const res = await handler(request, env, url);
      if (res) return res;
    }
    return errorResponse(404, 'Not found.');
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.message);
    console.error('[api]', request.method, url.pathname, err);
    return errorResponse(500, 'Something went wrong on our side. Please try again.');
  }
}
