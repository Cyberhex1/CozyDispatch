/**
 * Cloudflare Pages Function: serves every /api/* route with the D1 binding
 * and environment variables configured for the Pages project.
 */
import { handleApiRequest, type Env } from '../../src/server/apiRouter';

export const onRequest = (context: { request: Request; env: Env }) => handleApiRequest(context.request, context.env);
