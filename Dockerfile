# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
# Prisma on Alpine needs OpenSSL.
RUN apk add --no-cache openssl

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate the Prisma client for the runtime platform.
RUN npx prisma generate

EXPOSE 5000

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
