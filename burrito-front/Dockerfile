FROM node:20-bullseye AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --force

COPY . .
RUN npm run build
RUN npm prune --omit=dev --force

FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV PORT=4000
EXPOSE 4000

USER node

CMD ["node", "dist/burrito-front/server/server.mjs"]
