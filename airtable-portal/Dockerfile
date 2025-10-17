# Stage 1 — Build client
FROM node:20 AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --frozen-lockfile || pnpm install --frozen-lockfile || yarn install
COPY client .
RUN npm run build

# Stage 2 — Build server
FROM node:20 AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --frozen-lockfile || pnpm install --frozen-lockfile || yarn install
COPY server .

# Copy client build into server
COPY --from=client /app/client/dist ../client/dist

# Expose and start
EXPOSE 8080
ENV NODE_ENV=production
CMD ["npm", "start"]
