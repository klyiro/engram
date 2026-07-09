# Engram — the app is the repo root. The vault is mounted separately at VAULT_DIR.
FROM oven/bun:1

WORKDIR /app

# git + certs for the vault clone/sync loop
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["bun", "run", "start"]
