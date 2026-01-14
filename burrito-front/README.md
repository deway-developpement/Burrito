# Burrito Frontend

The Burrito frontend is an Angular SSR application that provides the UI for
students, teachers, and administrators. It communicates with the API gateway
over GraphQL and REST auth endpoints.

## Features

- Angular SSR with server-side rendering and hydration.
- Role-based UI flows (admin, teacher, student).
- GraphQL data layer with Apollo.
- Runtime API base URL configuration.
- Internationalization (fr, de, es).

## Prerequisites

- Node.js 20+
- Angular CLI 20 (installed via `npm install`)

## Setup

```bash
npm install
```

## Development

Start the dev server:

```bash
npm start
```

Defaults:
- Frontend: `http://localhost:4200`
- API Gateway (expected): `http://localhost:3000`

The dev server proxies `/auth`, `/api`, and `/graphQL` to the API gateway using
`proxy.conf.json`.

## Runtime Configuration

The API base URL is resolved in `src/app/config/runtime-config.ts`:

- `window.__env.API_BASE_URL` (served from `/env.js`)
- `process.env.API_BASE_URL` (SSR or build-time)
- Defaults:
  - Dev: `http://localhost:3000`
  - Prod: `https://api.burrito.deway.fr`

The SSR server exposes `/env.js` in `src/server.ts` and also injects
`globalThis.__env` for server-side rendering.

## Build

```bash
npm run build
```

The build output is in `dist/burrito-front/` with SSR assets and localized
bundles.

## Run SSR Output

After building, you can run the SSR server:

```bash
node dist/burrito-front/server/server.mjs
```

The server listens on `PORT` (default `4000`).

## Testing

```bash
npm test
```

## Project Structure

```
burrito-front/
├── src/
│   ├── app/                # pages, services, components
│   ├── server.ts           # SSR express server + runtime config
│   ├── main.ts             # browser entry
│   ├── main.server.ts      # server entry
│   └── styles/             # global styles
├── proxy.conf.json         # dev proxy to API gateway
└── angular.json
```

## Troubleshooting

- GraphQL endpoint is `/graphQL` (case-sensitive).
- If API calls fail locally, ensure the backend is running on `localhost:3000`.
- For SSR, confirm `API_BASE_URL` is set correctly or `/env.js` is reachable.
