import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleApiRequest } from './src/server/apiRouter';
import { getDb } from './src/server/db/d1Client';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Bridge Express /api routes to the universal Cloudflare D1 API Router
app.all('/api/{*splat}', async (req, res) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const url = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const webRequest = new Request(url, init);
    const webResponse = await handleApiRequest(webRequest);

    res.status(webResponse.status);
    webResponse.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const contentType = webResponse.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const json = await webResponse.json();
      return res.json(json);
    } else {
      const text = await webResponse.text();
      return res.send(text);
    }
  } catch (err: any) {
    console.error('[Server API Proxy Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// Vite Middleware for development vs static production serve
async function setupViteMiddleware() {
  // Ensure local D1 SQLite database and schema are initialized
  await getDb();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CozyDispatch server running on http://localhost:${PORT}`);
    console.log(`Persistent Database: Cloudflare D1 / Local SQLite (.data/cozydispatch.sqlite)`);
    console.log(`Pages Functions Gateway: Ready (functions/api/[[route]].ts)`);
  });
}

setupViteMiddleware().catch((err) => {
  console.error('Failed to start server:', err);
});
