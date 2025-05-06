FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
WORKDIR /app
COPY ./package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env

# Declare build argument for Git hash
ARG GIT_HASH=unknown

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Set environment variable from build argument
ENV GIT_HASH=$GIT_HASH

COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY public ./public
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION
RUN npx prisma generate
COPY app ./app
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/prisma ./prisma
COPY --from=build-env /app/public ./public
COPY --from=build-env /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build-env /app/dist ./dist
CMD ["npm", "run", "start"]