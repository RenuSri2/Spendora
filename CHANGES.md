# v0.3.0 — AI comparison fixes, Lightpanda instead of headless Chrome

## Why the AI comparison was broken on Vercel
1. **Request ran past Vercel's 60s limit.** Origin scrape (8s) → Chrome launch +
   20s navigation → 4 platform scrapes and up to 15 "other seller" scrapes, each
   able to launch Chrome. Vercel killed it with a 504 HTML page, and the
   frontend's `response.json()` threw → "Something went wrong".
2. **The HF model never answered.** `google/gemma-4-E4B-it` has no inference
   provider on the HF router, so every insight request failed.
3. **Stores block Vercel IPs**, so comparison scraping mostly failed anyway, and
   an origin page that blocked us ended the whole analysis with a 422.
4. **Search wasn't localised** (no `gl=in`) and long Amazon titles were pasted
   verbatim as queries; pure Jaccard similarity rejected long titles and
   accepted wrong variants/accessories; USD prices could show up as ₹.
5. **Node 20** pinned in `.node-version` — Vercel disabled Node 20 for new
   deployments on 1 Oct 2026.

## What changed
- Removed `puppeteer`, `puppeteer-extra`, stealth plugin, `@sparticuz/chromium`.
  New `src/lib/scraper/renderer.ts` uses **Lightpanda** via render server
  (HF Spaces), Lightpanda Cloud/CDP, or a local binary — skipped cleanly if
  none is configured.
- New `src/lib/scraper/unblocker.ts` — optional scraping-API tier
  (ScraperAPI by default, or Scrape.do / Scrapfly / ZenRows; India proxies)
  used only when a store blocks plain fetch — just set `SCRAPING_API_KEY`.
  Cheap request first, premium only if still blocked. This is what actually gets past Amazon/Croma
  from Vercel.
- New `scraper-server/` — zero-dependency Lightpanda render server + Dockerfile
  ready for Hugging Face Spaces (token auth, SSRF guard, concurrency limit).
- Comparison: Google Shopping (Serper `/shopping`) + site search + discovery in
  parallel under a time budget; variant/tier/accessory/price-sanity guards;
  INR-only; per-platform reasons when unmatched.
- Blocked origin page: product identified via search/URL slug, price from the
  store's own Google Shopping listing (flagged `partial`, low confidence).
- HF: working Gemma 4 model chain, robust JSON extraction, stops on auth/quota
  errors, rule-based fallback insight so the page is never empty.
- API always returns JSON within ~52s; DB/history is optional and time-boxed;
  `GET /api/ai-analysis` shows what's configured.
- Price parsing fix: `"Rs. 1,299"` was parsed as `0.1299`.
- JSON-LD: `@graph`, `AggregateOffer`, `ProductGroup`, image objects.
- Frontend: sends the normalised `https://` URL (scheme-less links used to pass
  the client check and fail on the server), handles non-JSON/timeout
  responses, shows partial results, sources, reasons and AI-vs-rules label.
- Fonts via the `geist` package (no Google Fonts fetch at build time).
- Node 24 (`engines`, `.node-version`).
- `npm run test:e2e` — end-to-end suite (102 checks), see README.

## New / changed env vars (all optional except as noted in README)
`SCRAPING_API_PROVIDER`, `SCRAPING_API_KEY`, `SCRAPING_API_PREMIUM`,
`SCRAPING_API_RENDER`, `SCRAPING_API_COUNTRY`, `SCRAPER_SERVER_URL`, `SCRAPER_SERVER_TOKEN`, `LIGHTPANDA_TOKEN`,
`LIGHTPANDA_WS_URL`, `LIGHTPANDA_EXECUTABLE_PATH`, `BROWSER_RENDER=off`,
`SERPER_GL`, `SERPER_HL`, `HF_MODEL` (now comma-separated; remove any old
`google/gemma-4-E4B-it` value from Vercel).
