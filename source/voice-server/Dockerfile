FROM node:20-bookworm-slim AS build
ENV PYTHON=python3 \
  MEDIASOUP_BUILDTYPE=plain \
  MESON_ARGS=-Dms_disable_liburing=true \
  CFLAGS=-O0\ -g0 \
  CXXFLAGS=-O0\ -g0
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip build-essential \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY browser ./browser
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY src ./src
COPY --from=build /app/public ./public
EXPOSE 3000/tcp 40000-40100/udp
CMD ["node", "src/server.js"]
