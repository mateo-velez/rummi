# ---- Stage 1: Build the React client ----
FROM node:22-alpine AS client-build
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:22-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=client-build /build/dist ./public

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server.js"]
