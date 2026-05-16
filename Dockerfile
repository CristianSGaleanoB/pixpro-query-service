FROM node:22-alpine AS base

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --ignore-scripts

FROM base AS development

EXPOSE 3001
CMD ["pnpm", "start:dev"]

FROM base AS build

COPY . .
RUN pnpm build

FROM node:22-alpine AS production

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001
CMD ["node", "dist/main"]
