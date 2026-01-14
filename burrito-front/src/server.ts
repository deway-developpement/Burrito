import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const defaultApiBaseUrl =
  process.env['NODE_ENV'] === 'production'
    ? 'https://api.burrito.deway.fr'
    : 'http://localhost:3000';
const rawApiBaseUrl = process.env['API_BASE_URL'] || defaultApiBaseUrl;
const apiBaseUrl = rawApiBaseUrl.endsWith('/') ? rawApiBaseUrl.slice(0, -1) : rawApiBaseUrl;
const supportedLocales = ['fr', 'de', 'es'];

(globalThis as { __env?: { API_BASE_URL?: string } }).__env = {
  ...(globalThis as { __env?: { API_BASE_URL?: string } }).__env,
  API_BASE_URL: apiBaseUrl,
};

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

app.get('/env.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(`window.__env = ${JSON.stringify({ API_BASE_URL: apiBaseUrl })};`);
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

supportedLocales.forEach((locale) => {
  const localeDistFolder = join(browserDistFolder, locale);
  const localeIndexPath = join(localeDistFolder, 'index.html');
  const localeRoute = new RegExp(`^/${locale}(?:/.*)?$`);

  app.use(
    `/${locale}`,
    express.static(localeDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    }),
  );

  app.get(localeRoute, (_req, res, next) => {
    if (!existsSync(localeIndexPath)) {
      return next();
    }
    return res.sendFile(localeIndexPath);
  });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
