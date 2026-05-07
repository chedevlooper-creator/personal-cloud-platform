FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/workspace ./services/workspace
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pcp/workspace-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/workspace ./services/workspace
WORKDIR /app/services/workspace
EXPOSE 3002
ENV PORT=3002
CMD ["node", "dist/index.js"]
