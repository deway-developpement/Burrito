# syntax=docker/dockerfile:1
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}-bullseye-slim AS builder
WORKDIR /app

# Install build tools for native modules (only in builder)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 git && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies (use package-lock.json if present for reproducible builds)
COPY ./package*.json ./
RUN npm ci --ignore-scripts --force

ARG SERVICE_NAME

# Copy sources and build
COPY . .
RUN npm run build ${SERVICE_NAME}

# Remove dev deps to keep only production modules
RUN npm prune --production --force

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ARG PORT=3000
ENV PORT=${PORT}

# Copy only what's needed for runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/intelligence-ms/proto ./apps/intelligence-ms/proto

RUN chown -R node:node /app

# Copy wait-for-it.sh
COPY wait-for-it.sh /usr/wait-for-it.sh
# Grant execute permission to wait-for-it.sh
RUN chmod +x /usr/wait-for-it.sh
# Allow wait-for-it.sh to be used by non-root user
RUN chown node:node /usr/wait-for-it.sh

# Use non-root user
USER node

EXPOSE ${PORT}

ARG SERVICE_NAME

# Make shortcut to service start
RUN ln -sf /app/dist/apps/${SERVICE_NAME}/main.js /app/dist/main.js


# Start the NestJS app after waiting for MongoDB to be ready
ENTRYPOINT ["/usr/wait-for-it.sh", "-t", "5", "mongo:27017", "--"]
CMD ["node", "dist/main.js"]
