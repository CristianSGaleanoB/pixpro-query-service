FROM node:22-alpine AS base

ENV HUSKY=0
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts

FROM base AS development

EXPOSE 2000
CMD ["pnpm", "start:dev"]

FROM base AS build

COPY . .
RUN pnpm build

FROM node:22-alpine AS production

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 2000
CMD ["node", "dist/main"]
