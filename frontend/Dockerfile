# Node 24 stays the build runtime (Vite, workbox); bun 1.3.14 - the
# same pin as .github/workflows/* - is the package manager and script
# runner. Installing bun into the node image rather than using the
# oven-sh/bun image keeps the runtime identical to CI.
FROM node:24-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
