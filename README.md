# Spendora

Personal finance tracker — expenses, budgets, receipts, spending insights, and a
product price-checker with a Gemma-powered (via Hugging Face) read on whether something's worth buying.

## Stack

- Next.js 15 (App Router) + React 19
- Prisma + Postgres
- NextAuth (Google OAuth + a demo login); Google sign-in gated behind an email allow-list
- Cheerio-based scraping for product name/price extraction
- [Lightpanda](https://lightpanda.io) (Zig headless browser) for JS-rendered pages — no Chrome/Puppeteer launch anywhere
- Serper.dev (Google Search + Google Shopping) for cross-platform comparison
- Hugging Face Inference Providers (Gemma 4, free tier) for AI insight generation, with a rule-based fallback
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
  huggingface.co/settings/tokens (enable "Make calls to Inference
  Providers"). If unset or failing, the price-checker still works and shows a
  rule-based summary instead. Optional `HF_MODEL` (comma-separated) is tried
  before the default Gemma 4 chain.
- `SERPER_API_KEY` — powers cross-platform comparison (Google Search +
  Google Shopping via Serper.dev; free tier is 2,500 one-time queries, no
  credit card) and identifying products on pages that block us. If unset,
  single-URL scraping/insight still works; comparison says it's not configured.
- Optional render tier: `SCRAPER_SERVER_URL` + `SCRAPER_SERVER_TOKEN`, or
  `LIGHTPANDA_TOKEN`, or `LIGHTPANDA_EXECUTABLE_PATH` — see "JS rendering".

## AI Assistant / price checker — how it actually works

`POST /api/ai-analysis { "productUrl": "…" }` runs four steps against a ~52s
internal budget (Vercel's limit is 60s), so it always answers with JSON —
never a 504 page. `GET /api/ai-analysis` reports which parts are configured.

**1. Read the listing.** Plain `fetch()` first; name + price extracted from:

1. **Platform-specific selectors** for Amazon, Flipkart, Myntra, Nykaa, Croma
   (tried first: their JSON-LD often carries the MRP, not the selling price)
2. **JSON-LD** (`schema.org/Product`, incl. `@graph`, `AggregateOffer`, `ProductGroup`)
3. **Open Graph / microdata** meta tags

If that fails (JS-rendered page or bot-wall), the page is rendered by
**Lightpanda** — see "JS rendering" below — and extracted again.

If the store blocks us completely (Amazon often blocks Vercel's IPs), the
product is identified from search (ASIN / URL / URL slug) and its price is
taken from the store's own **Google Shopping listing**, clearly marked
`dataSource: "search-listing"`, `partial: true`, low confidence. Nothing is
ever fabricated: if no price can be found, it says so.

**2. Compare across stores** (all in parallel, time-boxed):

- **Google Shopping** via Serper — merchant + feed price for each listing.
  This is what makes comparison work on Vercel, where most stores block direct
  scraping.
- **Known platforms** via `site:` search → scrape the matched page's live price
  (fetch, then Lightpanda if configured).
- **Other sellers** via a broad "buy … online" search → only kept if a real
  scrape confirms a matching product in ₹.

Matching blends token-overlap scores and rejects different variants
(128GB vs 256GB, S24 vs S24 Ultra, iPhone 15 vs 15 Pro), accessories ("case
for iPhone 15") and implausible prices (<0.4× or >2.5× the listing). Non-INR
listings are dropped. Unmatched platforms are listed with the reason.

**3. Score** — deterministic value score + data-confidence (unchanged idea:
no LLM guessing). Price history is stored per URL when `DATABASE_URL` works;
a slow or missing database no longer breaks the analysis.

**4. Narrate** — Hugging Face router, trying `HF_MODEL` then
`google/gemma-4-26B-A4B-it` → `google/gemma-4-31B-it` →
`meta-llama/Llama-3.1-8B-Instruct`. (The old default
`google/gemma-4-E4B-it` isn't served by any inference provider, so it always
failed.) Auth/quota errors stop immediately. If every model fails, a
rule-based summary is returned (`meta.insightSource: "rules"`) so the page is
never empty.

### Scraping API for blocked stores (optional, free tier)

Amazon and Croma block Vercel's datacenter IPs regardless of which browser
asks — an IP-reputation problem no headless browser fixes. Paste a free
ScraperAPI key into `SCRAPING_API_KEY` and blocked pages are re-fetched
through India-based residential proxies. (`SCRAPING_API_PROVIDER` can switch
to `scrapedo`, `scrapfly` or `zenrows`.)

Credit-saving by default: it's only called when plain fetch is blocked or
empty (never for speculative "other seller" pages), it tries a cheap standard
request first, and uses premium/residential mode only if the page is still a
bot wall. Without a key, blocked pages fall back to Google Shopping prices.

### JS rendering (Lightpanda, optional)

Headless Chrome (`puppeteer`, `@sparticuz/chromium`, stealth plugin) has been
removed. The render tier now uses Lightpanda, through whichever of these is
configured (tried in this order):

| Option | Env vars | Best for |
| --- | --- | --- |
| Render server on **Hugging Face Spaces** (`scraper-server/`) | `SCRAPER_SERVER_URL`, `SCRAPER_SERVER_TOKEN` | Vercel, free |
| **Lightpanda Cloud** / any CDP endpoint | `LIGHTPANDA_TOKEN` or `LIGHTPANDA_WS_URL` | Vercel, managed |
| **Local binary** | `LIGHTPANDA_EXECUTABLE_PATH` | VPS / Docker / local dev |

None set? The tier is skipped and everything else still works. See
[`scraper-server/README.md`](scraper-server/README.md) for the 5-minute HF
Spaces setup. Local binary: `pip install lightpanda` (bundles it) or
`npx @lightpanda/browser install`.

### End-to-end test

```bash
npm run build
# fake stores must resolve locally (remove the line afterwards):
echo "127.0.0.1 www.amazon.in www.flipkart.com www.croma.com www.reliancedigital.in www.usd-gadgets.com www.indie-store.in" | sudo tee -a /etc/hosts
LIGHTPANDA_EXECUTABLE_PATH=$(python -c 'import lightpanda,os;print(os.path.dirname(lightpanda.__file__)+"/lightpanda")') npm run test:e2e
```

It runs the production build against mock stores + mock Serper + mock HF +
mock scraping APIs, with the real Lightpanda in all three modes (local binary,
render server, CDP), plus "no browser", "bad HF token", "bad scraping-API key"
and "nothing configured" setups, and drives the actual UI pages through
Lightpanda (102 checks).

## Project structure notes

- All API routes live under `src/app/api/*` (App Router) — there used to be a
  parallel `src/pages/api/*` set, which has been removed.
- No `Category` database model exists — expense/budget categories are plain
  strings. (Some older code assumed a relational Category model that was never
  actually created; that's been fixed.)

## Deploying

Currently deployed on Vercel. **Node 24** (`engines: 24.x`) — Vercel disabled
Node 20 for new deployments on 1 Oct 2026, which is what the old
`.node-version` (20) pinned. `npm run build` runs `prisma generate && prisma
migrate deploy && next build`, so migrations apply automatically on deploy —
just make sure `DATABASE_URL` is set in the Vercel project.
