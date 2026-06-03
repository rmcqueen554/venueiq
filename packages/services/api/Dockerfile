FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer-cached)
COPY package.json ./
RUN npm install --legacy-peer-deps --no-fund --no-audit

# Generate Prisma client with a dummy URL (generate only reads schema, no DB needed)
COPY prisma ./prisma/
RUN DATABASE_URL="postgresql://build:build@localhost/build" npx prisma generate

# Copy source
COPY src ./src/

EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000

CMD ["npx", "tsx", "src/index.ts"]
