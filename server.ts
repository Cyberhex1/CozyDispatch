/**
 * Local development / self-hosted server. Serves the Vite app and bridges
 * /api/* to the same router Cloudflare runs, using a local SQLite database
 * (.data/cozydispatch.sqlite) in place of D1.
 */
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { handleApiRequest, type Env } from './src/server/apiRouter';
import { createLocalD1 } from './src/server/db/localSqlite';

const PORT = Number(process.env.PORT) || 3000;
const env: Env = {
  DB: createLocalD1(),
  APP_URL: process.env.APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

// Pass the raw body through untouched so the router sees exactly what the browser sent.
app.all('/api/{*splat}', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0;
  const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined
  });

  const response = await handleApiRequest(request, env);
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.send(Buffer.from(await response.arrayBuffer()));
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(PORT, () => {
    console.log(`CozyDispatch running at http://localhost:${PORT}`);
    console.log('Using the local database in .data/ — run `npm run sync` to fill it with games and news.');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
