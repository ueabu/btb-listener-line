# Listener Line on Fly.io. Build with scripts/fly-deploy.sh so the NEXT_PUBLIC_* values are passed in.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked into the browser bundle at build time, so they're build args, not runtime secrets.
ARG NEXT_PUBLIC_APPS_SCRIPT_URL
ARG NEXT_PUBLIC_HOST_PASSWORD_HASH
ENV NEXT_PUBLIC_APPS_SCRIPT_URL=$NEXT_PUBLIC_APPS_SCRIPT_URL \
    NEXT_PUBLIC_HOST_PASSWORD_HASH=$NEXT_PUBLIC_HOST_PASSWORD_HASH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
