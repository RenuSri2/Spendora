# Spendora render server: Node + Lightpanda (no Chrome).
# Works as-is on Hugging Face Spaces (Docker SDK, port 7860), Render, Fly,
# Railway, or any VPS.

# Stage 1 — grab a pinned Lightpanda binary from its official PyPI wheel
# (the wheel bundles the browser; no GitHub download at build time).
FROM python:3.12-slim-bookworm AS lightpanda
ARG LIGHTPANDA_VERSION=1.0.3
RUN pip install --no-cache-dir "lightpanda==${LIGHTPANDA_VERSION}" \
 && cp "$(python -c 'import lightpanda, os; print(os.path.join(os.path.dirname(lightpanda.__file__), "lightpanda"))')" /lightpanda \
 && chmod +x /lightpanda

# Stage 2 — runtime
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=lightpanda /lightpanda /usr/local/bin/lightpanda

ENV NODE_ENV=production \
    PORT=7860 \
    LIGHTPANDA_EXECUTABLE_PATH=/usr/local/bin/lightpanda \
    LIGHTPANDA_DISABLE_TELEMETRY=true

# HF Spaces runs containers as uid 1000
RUN useradd -m -u 1000 app || true
WORKDIR /app
COPY --chown=1000:1000 server.mjs ./
USER 1000

EXPOSE 7860
CMD ["node", "server.mjs"]
