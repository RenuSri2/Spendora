# Spendora

Personal finance tracker — expenses, budgets, receipts, spending insights, and a
product price-checker with a Gemma-powered (via Hugging Face) read on whether something's worth buying.

## Stack

- Next.js 15 (App Router) + React 19
- Prisma + Postgres
- NextAuth (Google OAuth + a demo login), gated behind an email allow-list
- Cheerio-based scraping for product name/price extraction
- Hugging Face Inference Providers (Gemma 4, free tier) for AI insight generation
- Tesseract.js for receipt OCR

## Setup

```bash
npm install
cp .env.example .env   # fill in real values — never commit .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Required environment variables

See `.env.example`. In particular:

- `DATABASE_URL` — Postgres connection string
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `ALLOWED_EMAILS` — comma-separated list; only these emails can sign in (Google
  or demo login). Empty/unset means nobody can sign in — it fails closed, not open.
- `HF_API_TOKEN` — for the AI Assistant's product insight text (Hugging Face
  Inference Providers, free tier). Get one at
  huggingface.co/settings/tokens. If unset, the price-checker still works
  (real scraped name/price/history), it just won't generate the written
  recommendation. Optional `HF_MODEL` env var overrides the default
  (`google/gemma-4-E4B-it`).
- `SERPER_API_KEY` — powers cross-platform price comparison and general
  seller discovery via Serper.dev (Google Search API; free tier is 2,500
  one-time queries, no credit card). If unset, single-URL scraping/insight
  still works; comparison across other platforms just returns empty.

## AI Assistant / price checker — how it actually works

Paste a product URL and it extracts the name and current price, in this order:

1. **JSON-LD** (`schema.org/Product`) — most reliable, survives site redesigns
2. **Open Graph meta tags** — fallback if no JSON-LD
3. **Platform-specific CSS selectors** — last resort for Amazon, Flipkart,
   Myntra, Nykaa, Croma; these will need periodic upkeep as site markup changes

If none of that works, it returns an honest failure — it does **not** fall back
to fabricated data. Amazon in particular can block requests from datacenter IPs
(which is what Vercel's serverless functions run on) regardless of how the
request is formed; that's a known limitation, not a bug to chase.

Price history is real and accumulates over time: every time you check the same
URL, a new price snapshot is stored (`TrackedProduct` / `PriceSnapshot` in the
schema). There's no synthetic/generated history — a fresh URL just won't have
a chart yet.

### Cross-platform comparison

If `SERPER_API_KEY` is set, the app also searches the *other* platforms
(site-restricted queries like `site:flipkart.com <product name>`) via
Serper.dev, picks the best name match on each site by a token-overlap
similarity score, and scrapes the real price from that specific matched page
— same scraper/reliability tiers as above, not a separate system. It also
runs a broader, non-site-restricted search ("buy `<product name>` online")
to discover sellers beyond the 5 known platforms, useful for niche/regional
products. If no confident match is found (score below threshold, or the
match's own price couldn't be extracted), that platform/site is reported as
"not found" with a reason — never a guessed price. This is inherently
fuzzier than single-URL scraping since there's no product ID to match on
across sites, only name similarity — treat match confidence as a signal, not
a guarantee.

Get a key at serper.dev — no card required for the free tier. This
previously ran on a self-hosted SearXNG instance (Docker), which worked but
was unreliable under real testing load: SearXNG proxies live Google/Bing/
Brave queries, and repeated testing got the hosting IP rate-limited/
CAPTCHA'd by those engines. Serper avoids that since it's a dedicated API,
not a proxy through consumer search engines.

## Project structure notes

- All API routes live under `src/app/api/*` (App Router) — there used to be a
  parallel `src/pages/api/*` set, which has been removed.
- No `Category` database model exists — expense/budget categories are plain
  strings. (Some older code assumed a relational Category model that was never
  actually created; that's been fixed.)

## Deploying

Currently deployed on Vercel. `npm run build` runs `prisma generate && prisma
migrate deploy && next build`, so migrations apply automatically on deploy —
just make sure `DATABASE_URL` is set in the Vercel project.
