/**
 * functions/api/[[route]].ts
 *
 * Cloudflare Pages Functions API Gateway.
 * Automatically deployed by Cloudflare Pages to handle all /api/* routes on cozy-dispatch.pages.dev.
 * Passes the native D1 binding (`context.env.DB`) and environment variables to the unified API Router.
 */

import { handleApiRequest, EnvBindings } from '../../src/server/apiRouter';

interface EventContext {
  request: Request;
  env: EnvBindings;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, any>;
}

export async function onRequest(context: EventContext): Promise<Response> {
  return handleApiRequest(context.request, context.env);
}
