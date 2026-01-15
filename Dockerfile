# Build stage
FROM node:20-slim AS builder

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY prisma ./prisma/

# Install root dependencies
RUN npm ci

# Copy web package files and install web dependencies
COPY web/package*.json ./web/
RUN cd web && npm ci

# Copy all source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build backend
RUN npx tsc && npx tsc-alias

# Build web frontend
RUN cd web && npm run build

# Production stage
FROM node:20-slim AS production

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev && npx prisma generate

# Copy built backend
COPY --from=builder /app/dist ./dist

# Copy built frontend
COPY --from=builder /app/web/dist ./web/dist

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]
