FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/agent ./services/agent
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pcp/agent-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/agent ./services/agent
WORKDIR /app/services/agent
EXPOSE 3004
ENV PORT=3004
CMD ["node", "dist/index.js"]
