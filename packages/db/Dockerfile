FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS runner
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/db
ENTRYPOINT ["pnpm"]
CMD ["migrate"]
