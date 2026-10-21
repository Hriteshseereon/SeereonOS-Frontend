# SeereonOS web frontend: static SPA build served by nginx.
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t seereonos-web .
#   docker run -p 8080:8080 -e API_ORIGIN=https://api.example.com seereonos-web
# VITE_API_BASE_URL is baked into the JavaScript at build time (leave it empty when a reverse proxy serves the
# API on the same origin under /api). API_ORIGIN (runtime) only feeds the Content-Security-Policy connect-src.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# the official image renders /etc/nginx/templates/*.template with envsubst at start-up
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_ORIGIN=""
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
