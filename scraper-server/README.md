---
title: Spendora Render Server
emoji: 🐼
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Spendora render server (Lightpanda)

A tiny HTTP service that renders product pages with
[Lightpanda](https://lightpanda.io) — a lightweight headless browser written in
Zig — and returns the HTML. The Spendora app on Vercel calls it only when a
plain `fetch()` of a product page fails or comes back without price data.

No Chrome, no Puppeteer launch, no npm dependencies.

## Deploy on Hugging Face Spaces (free)

1. Create a new Space → **SDK: Docker** → blank template.
2. Upload the three files in this folder (`Dockerfile`, `server.mjs`,
   `README.md` — the YAML header above is what tells HF to use Docker on
   port 7860).
3. In the Space → **Settings → Variables and secrets**, add a secret
   `SCRAPER_SERVER_TOKEN` with a long random value
   (`openssl rand -hex 24`).
4. Wait for the build, then open `https://<user>-<space>.hf.space/` — you
   should see `{"ok":true,"engine":"lightpanda",...}`.
5. In Vercel → Project → Settings → Environment Variables set
   - `SCRAPER_SERVER_URL=https://<user>-<space>.hf.space`
   - `SCRAPER_SERVER_TOKEN=<same token>`

   and redeploy.

> Free Spaces sleep after inactivity; the first request after a nap can take
> ~30s to wake. The app treats a slow/failed render as "tier unavailable" and
> still answers with search-based comparison, so nothing breaks — the page
> just won't get a live re-render that time.

## Run anywhere else

```bash
docker build -t spendora-render .
docker run -p 7860:7860 -e SCRAPER_SERVER_TOKEN=change-me spendora-render
```

Or without Docker (Node ≥ 22 + a Lightpanda binary):

```bash
pip install lightpanda            # bundles the binary, or: npx @lightpanda/browser install
LIGHTPANDA_EXECUTABLE_PATH=/path/to/lightpanda SCRAPER_SERVER_TOKEN=change-me node server.mjs
```

## API

```
GET  /          → {"ok":true,"engine":"lightpanda","version":"1.0.3","active":0,"queued":0}
POST /render    Authorization: Bearer <token>
                {"url":"https://www.flipkart.com/...","timeoutMs":15000}
             → {"html":"<!DOCTYPE html>…","finalUrl":"…","status":200,"botChallenge":null,"tookMs":2140}
```

Environment variables: `SCRAPER_SERVER_TOKEN` (strongly recommended),
`PORT` (default 7860), `MAX_CONCURRENCY` (default 4),
`LIGHTPANDA_HTTP_PROXY` (optional egress proxy, e.g. a residential proxy for
sites that block datacenter IPs). Requests to private/internal IPs are
blocked by default (`--block-private-networks`).
