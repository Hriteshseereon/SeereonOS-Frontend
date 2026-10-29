# SeereonOS — web frontend

React 18 + TypeScript + Vite single-page app. It has **no data of its own**: every screen reads and writes through
the SeereonOS API (`backend/`, FastAPI + PostgreSQL). There is no mock or demo mode — if the API is unreachable the
app says so (a "Can't reach the server" banner that retries by itself, and error states with the server's message).

## Prerequisites

- Node.js 20 or 22 and npm 10
- A running SeereonOS API (see the backend's README) — locally on `http://localhost:8000`

## Configuration

One build-time variable (Vite bakes it into the JavaScript, so it is set when you **build**, not when you serve):

| Variable | Example | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` | Absolute base URL of the API, including `/api/v1`. **Unset or empty** → the app calls `/api/v1` on its own origin (the API serves the build, or a reverse proxy routes `/api` to it). |

Local settings go in `.env.local` (git-ignored; copy `.env.example`). Never commit real URLs with credentials or any
secret — the frontend needs none.

### Pairing with the backend's CORS_ORIGINS

The browser only lets the app call an API on **another origin** if the API allows that origin:

| Frontend served from | `VITE_API_BASE_URL` | Backend `CORS_ORIGINS` |
|---|---|---|
| `https://app.example.com` (static host / CDN / nginx image) | `https://api.example.com/api/v1` | `https://app.example.com` |
| the API itself (`STATIC_DIR` → `dist/`) | *(unset)* | *(not needed: same origin)* |
| a reverse proxy that routes `/api/*` to the API | *(unset)* | *(not needed: same origin)* |
| `npm run dev` on `http://localhost:5173` | `http://localhost:8000/api/v1` | `http://localhost:5173` (development) |

`CORS_ORIGINS` takes exact origins (scheme + host + port, no path, never `*`), comma-separated.

## Develop

```sh
npm ci
cp .env.example .env.local          # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev                         # http://localhost:5173 (the API must allow this origin in CORS_ORIGINS)
```

There is no dev proxy: the app calls the URL in `VITE_API_BASE_URL` directly, exactly as in production.
Create your first workspace with **Sign up**, or use whatever local fixtures the backend README describes.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload on :5173 |
| `npm run typecheck` | `tsc --noEmit` over `src/` (must be clean) |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serves the built `dist/` on :4173 to smoke-test a build |

## Build and deploy

```sh
npm ci                                                             # exact dependencies from package-lock.json
VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build     # → dist/ (index.html + hashed assets/)
grep -rl "api.example.com" dist/assets | head -1                   # check: the API URL is baked in
```

`VITE_API_BASE_URL` is read at build time only: changing it later means building again (a built bundle cannot be
re-pointed by an environment variable on the web server).

`dist/` is plain static files. Deploy it any of these ways:

1. **Any static web server or CDN** (nginx, Apache, S3 + CloudFront, Netlify, Azure Static Web Apps…). Requirements:
   - **SPA fallback**: unknown paths must return `index.html` with status 200, so deep links such as
     `/projects/42` or the emailed `/reset-password?token=…` and `/invite/<token>` links work (log retention: the reset
     token is in the query string of that page request, so keep static-host access logs short-lived or strip queries).
   - Cache `assets/*` for a long time (file names are content-hashed); serve `index.html` with `Cache-Control: no-cache`
     so a new release is picked up immediately.
   - HTTPS. Set the backend's `APP_URL` to this public URL (links in emails point here) and add the origin to
     `CORS_ORIGINS`.
   - **Vercel** (current hosting): `vercel.json` in this folder adds the SPA fallback. In the Vercel project set
     `VITE_API_BASE_URL` (Settings → Environment Variables, Production) and redeploy after changing it; build command
     `npm run build`, output directory `dist`.
2. **The Docker image in this folder** (nginx, non-root, port 8080, SPA fallback, caching and security headers):

   ```sh
   docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t seereonos-web .
   docker run -p 8080:8080 -e API_ORIGIN=https://api.example.com seereonos-web
   ```

   `API_ORIGIN` is only used in the Content-Security-Policy (`connect-src`); leave it empty when the API is on the
   same origin. The nginx config is `deploy/nginx.conf.template`; `/healthz` answers `ok`.
3. **Served by the API**: build without `VITE_API_BASE_URL` and point the backend's `STATIC_DIR` at `dist/`; the API
   serves the SPA (with fallback) and `/api/v1` on one origin — no CORS needed.

### Content-Security-Policy

If your host sets a CSP, allow: `script-src 'self' https://checkout.razorpay.com`;
`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`; `font-src 'self' data: https://fonts.gstatic.com`;
`connect-src 'self' data: blob: <API origin> https://api.razorpay.com https://lumberjack.razorpay.com`;
`frame-src 'self' blob: data: https://api.razorpay.com https://checkout.razorpay.com`; `img-src 'self' data: blob:`.
Razorpay entries are only needed when online payment is enabled on the server.

## How data stays fresh

- All API reads use `fetch(..., { cache: 'no-store' })`; TanStack Query is the only cache.
- After **any** successful write the app invalidates every cached query and refetches what is on screen, so new
  records appear in lists, details and dashboards immediately; other screens refetch when opened. Coming back to the
  browser tab also refetches (`refetchOnWindowFocus`). POSTs that only compute or read — previews, quotes,
  simulations, report runs (`READ_ONLY_POST` in `src/api/http.ts`) — are not writes; a new query endpoint implemented
  as a POST must be added there, or every run refreshes every query and re-runs itself.
- A `401` signs the person out and returns them to the sign-in page.

## Payments

The billing page shows online payment only when the API reports `payments.enabled` (Razorpay keys configured on the
server). Payment runs as: server creates the order → Razorpay Checkout (loaded on demand) → server verifies the
signature → the page shows the server's result. With payments disabled the page shows plan, seats and invoices and
how to contact support — there are no pay buttons, and nothing is ever marked paid by the browser.

## Layout of `src/`

```
api/        http.ts (transport), query.ts (useApi/useMut + refresh after writes), <module>.ts clients, types/ (API JSON shapes)
app/        router, shell, auth layout, connection banner
domain/     pure helpers: calendar, money formatting, labels, permissions catalogue, letter markup (docMarkup), defaults
modules/    screens by area
ui/         design system components
mock/       NOT part of the app — frozen TypeScript reference used by backend tooling; excluded from the build
```

See `CONVENTIONS.md` for code and design conventions.
