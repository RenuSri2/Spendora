#!/usr/bin/env node
// End-to-end test for the AI price-comparison pipeline.
//
// Runs the real production build (`next start`) against a mock world
// (fake stores + fake Serper + fake Hugging Face router) and, when a
// Lightpanda binary is available, the real Lightpanda browser for the
// JS-rendering tier — in all three modes (local binary, render server, CDP).
//
// Prereqs:
//   1. npm run build   (or `next build`)
//   2. These hostnames must resolve to 127.0.0.1 — add to /etc/hosts:
//      127.0.0.1 www.amazon.in www.flipkart.com www.croma.com www.reliancedigital.in www.usd-gadgets.com www.indie-store.in
//   3. Optional: LIGHTPANDA_EXECUTABLE_PATH=/path/to/lightpanda
//      (pip install lightpanda, or npx @lightpanda/browser install)
//
// Usage: node scripts/e2e/run.mjs        (REMEMBER to remove the hosts line afterwards)

import { spawn } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMocks, URLS, API_PORT, hfCalls, unblockCalls } from './mock-server.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LIGHTPANDA = process.env.LIGHTPANDA_EXECUTABLE_PATH
const HAS_LP = Boolean(LIGHTPANDA && existsSync(LIGHTPANDA))
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')

let passed = 0
let failed = 0
const failures = []
function check(name, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`    ✓ ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`    ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(url, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const r = await fetch(url)
      if (r.status < 500) return
    } catch {}
    await sleep(300)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function startProc(cmd, args, env, label) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.logs = ''
  child.stdout.on('data', (d) => (child.logs += d))
  child.stderr.on('data', (d) => (child.logs += d))
  child.label = label
  return child
}

async function stop(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((r) => child.once('exit', r)), sleep(3000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

const BASE_ENV = {
  NODE_ENV: 'production',
  SERPER_API_KEY: 'test-serper-key',
  SERPER_BASE_URL: `http://127.0.0.1:${API_PORT}`,
  HF_API_TOKEN: 'test-hf-token',
  HF_BASE_URL: `http://127.0.0.1:${API_PORT}/hf/v1`,
  DATABASE_URL: '', // history is optional — must not break analysis
  LIGHTPANDA_EXECUTABLE_PATH: '',
  SCRAPER_SERVER_URL: '',
  SCRAPING_API_PROVIDER: '',
  SCRAPING_API_KEY: '',
  LIGHTPANDA_WS_URL: '',
  LIGHTPANDA_TOKEN: '',
  NEXTAUTH_SECRET: 'e2e',
  NEXTAUTH_URL: 'http://127.0.0.1',
}

async function withApp(name, port, env, fn) {
  console.log(`\n▶ ${name}`)
  const app = startProc(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], { ...BASE_ENV, ...env, PORT: String(port) }, name)
  try {
    await waitFor(`http://127.0.0.1:${port}/api/ai-analysis`)
    await fn(`http://127.0.0.1:${port}`)
  } catch (err) {
    check(`${name}: ran without crashing`, false, err.message)
    console.log(app.logs.slice(-3000))
  } finally {
    await stop(app)
  }
}

async function analyse(base, productUrl) {
  const t = Date.now()
  const res = await fetch(`${base}/api/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productUrl }),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text, ms: Date.now() - t }
}

const byPlatform = (r, p) => r.json?.comparison?.find((c) => c.platform === p)

async function iphoneScenario(base, { expectFlipkartScraped, expectAi }) {
  const r = await analyse(base, URLS.amazonIphone)
  const j = r.json
  console.log(`    (${r.ms} ms)`)
  check('iPhone: HTTP 200 + JSON success', r.status === 200 && j?.success === true, `status ${r.status}: ${r.text.slice(0, 200)}`)
  if (!j?.success) return
  check('iPhone: selling price ₹69,900 (not the ₹79,900 MRP)', j.product.price === 69900, `got ${j.product.price}`)
  check('iPhone: source is platform-selector', j.product.dataSource === 'platform-selector', j.product.dataSource)

  const fk = byPlatform(r, 'flipkart')
  check('iPhone: Flipkart matched at ₹65,999', fk?.matched && fk.price === 65999, JSON.stringify(fk))
  if (expectFlipkartScraped) check('iPhone: Flipkart price read from the JS-rendered page (Lightpanda)', fk?.source === 'scraped', fk?.source)
  else check('iPhone: Flipkart price falls back to Google Shopping (no renderer)', fk?.source === 'google-shopping', fk?.source)

  const croma = byPlatform(r, 'croma')
  check('iPhone: Croma (blocked page) still priced via Google Shopping', croma?.matched && croma.price === 66490 && croma.source === 'google-shopping', JSON.stringify(croma))

  const rel = j.comparison.find((c) => c.platform.includes('reliancedigital'))
  check('iPhone: Reliance Digital discovered + scraped (₹67,900)', rel?.matched && rel.price === 67900 && rel.source === 'scraped', JSON.stringify(rel))
  check('iPhone: Vijay Sales found via Shopping (₹66,999)', j.comparison.some((c) => c.label === 'Vijay Sales' && c.price === 66999))
  check('iPhone: no USD store, accessory or Pro variant in results', !j.comparison.some((c) => c.matched && (c.price < 10000 || c.price > 100000 || /usd-gadgets|best ?buy/i.test(c.platform + c.label))), JSON.stringify(j.comparison.map((c) => [c.label, c.price])))
  check('iPhone: Amazon (origin) not listed as its own competitor', !j.comparison.some((c) => c.platform === 'amazon'))
  const prices = j.comparison.filter((c) => c.matched).map((c) => c.price)
  check('iPhone: matches sorted cheapest first', prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.join(','))
  check('iPhone: unmatched platforms carry a reason', j.comparison.filter((c) => !c.matched).every((c) => c.reason))
  check('iPhone: value score says it is pricier than cheapest', j.valueScore.score < 90 && /more expensive/.test(j.valueScore.basis.join(' ')), JSON.stringify(j.valueScore))
  if (expectAi) {
    check('iPhone: insight written by HF (fell through to 2nd model)', j.meta.insightSource === 'ai' && j.meta.insightModel === 'google/gemma-4-31B-it', JSON.stringify(j.meta))
  } else {
    check('iPhone: insight falls back to rule-based', j.meta.insightSource === 'rules' && j.insight.summary.length > 0, JSON.stringify(j.meta))
  }
  check('iPhone: works without a database', j.meta.historyStored === false && j.priceHistory.length === 1)
  check('iPhone: finished inside the serverless budget (<55s)', r.ms < 55_000, `${r.ms}ms`)
  return j
}

async function main() {
  // --- prerequisites ---
  for (const host of ['www.amazon.in', 'www.flipkart.com', 'www.croma.com', 'www.reliancedigital.in', 'www.usd-gadgets.com', 'www.indie-store.in']) {
    const { address } = await lookup(host).catch(() => ({ address: null }))
    if (address !== '127.0.0.1') {
      console.error(`✗ ${host} must resolve to 127.0.0.1 for this test (see header of scripts/e2e/run.mjs)`)
      process.exit(2)
    }
  }
  if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    console.error('✗ No production build found — run `npm run build` (or `npx next build`) first')
    process.exit(2)
  }
  console.log(HAS_LP ? `Lightpanda: ${LIGHTPANDA}` : 'Lightpanda: not found — render-tier tests will be skipped')

  const mocks = await startMocks()
  const helpers = []

  try {
    // ---------------------------------------------------------------- 1
    if (HAS_LP) {
      await withApp('Local Lightpanda binary', 3101, { LIGHTPANDA_EXECUTABLE_PATH: LIGHTPANDA, LIGHTPANDA_ALLOW_PRIVATE: '1' }, async (base) => {
        const health = await (await fetch(`${base}/api/ai-analysis`)).json()
        check('health: reports lightpanda-local backend', health.renderBackends?.includes('lightpanda-local'), JSON.stringify(health))
        await iphoneScenario(base, { expectFlipkartScraped: true, expectAi: true })

        // Origin blocked (CAPTCHA) → identify via search, price from its Shopping listing
        const r = await analyse(base, URLS.amazonS24Blocked)
        const j = r.json
        console.log(`    (${r.ms} ms)`)
        check('S24 (blocked origin): still succeeds', r.status === 200 && j?.success, r.text.slice(0, 300))
        if (j?.success) {
          check('S24: product identified from search', /Galaxy S24/i.test(j.product.name), j.product.name)
          check('S24: price from Google Shopping listing ₹74,999', j.product.price === 74999 && j.product.dataSource === 'search-listing', `${j.product.price} ${j.product.dataSource}`)
          check('S24: flagged partial + low confidence + note', j.partial === true && j.dataConfidence.level === 'low' && j.notes.length > 0)
          const fk = byPlatform(r, 'flipkart')
          check('S24: Flipkart matched ₹72,999', fk?.matched && fk.price === 72999, JSON.stringify(fk))
          check('S24: S24 Ultra not matched', !j.comparison.some((c) => c.matched && c.price > 100000))
        }

        // Scheme-less URL + OG-meta "Rs. 1,299" parsing on an unknown store
        const k = await analyse(base, URLS.indieKettle.replace('http://', ''))
        check('Kettle: scheme-less URL accepted', k.status === 200 || k.status === 422, `status ${k.status}`)
        // (served over http only, so the https:// normalisation can't connect — test the http form too)
        const k2 = await analyse(base, URLS.indieKettle)
        check('Kettle: "Rs. 1,299" parsed as 1299 (was 0.1299)', k2.json?.product?.price === 1299, JSON.stringify(k2.json?.product))

        const bad = await analyse(base, 'not a url at all')
        check('Invalid URL → 400 JSON error', bad.status === 400 && typeof bad.json?.error === 'string', `${bad.status}`)

        // UI: drive the real pages with Lightpanda over CDP
        const lp = startProc(LIGHTPANDA, ['serve', '--host', '127.0.0.1', '--port', '9333', '--log-level', 'fatal'], { LIGHTPANDA_DISABLE_TELEMETRY: 'true' }, 'lp-ui')
        helpers.push(lp)
        await sleep(800)
        await uiTest(base, 'ws://127.0.0.1:9333')
        await stop(lp)
      })

      // ---------------------------------------------------------------- 2
      const rs = startProc(process.execPath, ['scraper-server/server.mjs'], {
        PORT: '7870', SCRAPER_SERVER_TOKEN: 'rs-secret', LIGHTPANDA_EXECUTABLE_PATH: LIGHTPANDA, ALLOW_PRIVATE_NETWORKS: '1',
      }, 'render-server')
      helpers.push(rs)
      await waitFor('http://127.0.0.1:7870/')
      const unauth = await fetch('http://127.0.0.1:7870/render', { method: 'POST', body: '{"url":"http://example.com"}' })
      console.log('\n▶ Render server (HF Spaces image)')
      check('render server: rejects requests without the token', unauth.status === 401)
      await withApp('App → render server (SCRAPER_SERVER_URL)', 3102, { SCRAPER_SERVER_URL: 'http://127.0.0.1:7870', SCRAPER_SERVER_TOKEN: 'rs-secret' }, async (base) => {
        await iphoneScenario(base, { expectFlipkartScraped: true, expectAi: true })
      })
      check('render server: served the render requests', /render-server\] www\.flipkart\.com ok/.test(rs.logs), rs.logs.slice(-500))
      await stop(rs)

      // ---------------------------------------------------------------- 3
      const lpServe = startProc(LIGHTPANDA, ['serve', '--host', '127.0.0.1', '--port', '9444', '--log-level', 'fatal'], { LIGHTPANDA_DISABLE_TELEMETRY: 'true' }, 'lightpanda-serve')
      helpers.push(lpServe)
      await sleep(800)
      await withApp('App → Lightpanda CDP (LIGHTPANDA_WS_URL, same path as Lightpanda Cloud)', 3103, { LIGHTPANDA_WS_URL: 'ws://127.0.0.1:9444' }, async (base) => {
        await iphoneScenario(base, { expectFlipkartScraped: true, expectAi: true })
      })
      await stop(lpServe)
    }

    // ---------------------------------------------------------------- 4
    await withApp('No browser at all + HF token rejected (typical broken Vercel setup)', 3104, { HF_API_TOKEN: 'bad-token' }, async (base) => {
      const health = await (await fetch(`${base}/api/ai-analysis`)).json()
      check('health: no render backends', Array.isArray(health.renderBackends) && health.renderBackends.length === 0, JSON.stringify(health))
      const calls = hfCalls.length
      await iphoneScenario(base, { expectFlipkartScraped: false, expectAi: false })
      check('HF 401 stops after one attempt (no pointless model retries)', hfCalls.length - calls === 1, `${hfCalls.length - calls} calls`)
    })

    // ---------------------------------------------------------------- 5
    for (const provider of ['scraperapi', 'scrapfly']) {
      const basePath = provider === 'scrapfly' ? '/scrapfly' : '/scrapingapi/'
      await withApp(`Scraping API tier (${provider}) — beats the bot walls`, provider === 'scrapfly' ? 3107 : 3106, {
        // scraperapi run sets only the key — it must be the default provider
        SCRAPING_API_PROVIDER: provider === 'scraperapi' ? '' : provider,
        SCRAPING_API_KEY: 'test-unblock',
        SCRAPING_API_BASE_URL: `http://127.0.0.1:${API_PORT}${basePath}`,
      }, async (base) => {
        const health = await (await fetch(`${base}/api/ai-analysis`)).json()
        check(`${provider}: health reports scraping API`, health.scrapingApi === provider, JSON.stringify(health))
        const before = unblockCalls.length
        const r = await analyse(base, URLS.amazonS24Blocked)
        const j = r.json
        check(`${provider}: blocked Amazon page now read directly (₹73,499, live page)`, j?.product?.price === 73499 && j.product.dataSource === 'platform-selector' && j.partial === false, JSON.stringify(j?.product))
        check(`${provider}: no "couldn't read" note`, Array.isArray(j?.notes) && j.notes.length === 0, JSON.stringify(j?.notes))
        const calls = unblockCalls.slice(before)
        check(`${provider}: requests routed via India (country=in)`, calls.length > 0 && calls.every((c) => c.country === 'in'), JSON.stringify(calls))
        const s24Calls = calls.filter((c) => c.url.includes('Galaxy-S24'))
        check(`${provider}: cheap request first, premium only after it was still blocked`, s24Calls.length === 2 && !s24Calls[0].premium && s24Calls[1].premium, JSON.stringify(s24Calls))
        const r2 = await analyse(base, URLS.amazonIphone)
        const croma = byPlatform(r2, 'croma')
        check(`${provider}: blocked Croma page scraped live (₹66,290)`, croma?.matched && croma.price === 66290 && croma.source === 'scraped', JSON.stringify(croma))
        const cromaCalls = unblockCalls.slice(before).filter((c) => c.url.includes('croma'))
        check(`${provider}: Croma needed only the cheap (non-premium) request`, cromaCalls.length === 1 && !cromaCalls[0].premium, JSON.stringify(cromaCalls))
        const unblockedUrls = unblockCalls.slice(before).map((c) => c.url)
        check(`${provider}: credits only spent on blocked pages (not open sites)`, !unblockedUrls.some((u) => /reliancedigital|indie-store|usd-gadgets/.test(u)), unblockedUrls.join(', '))
      })
    }
    await withApp('Scraping API with a wrong key degrades gracefully', 3108, {
      SCRAPING_API_PROVIDER: 'scraperapi', SCRAPING_API_KEY: 'wrong', SCRAPING_API_BASE_URL: `http://127.0.0.1:${API_PORT}/scrapingapi/`,
    }, async (base) => {
      const r = await analyse(base, URLS.amazonS24Blocked)
      check('bad key: still succeeds via Google Shopping fallback', r.json?.success && r.json.product.price === 74999 && r.json.product.dataSource === 'search-listing', JSON.stringify(r.json?.product))
    })

    // ---------------------------------------------------------------- 6
    await withApp('Nothing configured (no Serper, no HF, no browser)', 3105, { SERPER_API_KEY: '', HF_API_TOKEN: '' }, async (base) => {
      const r = await analyse(base, URLS.relianceIphone)
      check('bare: still analyses a JSON-LD page', r.status === 200 && r.json?.product?.price === 67900, r.text.slice(0, 200))
      check('bare: comparison explains search is not configured', r.json?.comparison?.every((c) => !c.matched && /SERPER_API_KEY/.test(c.reason)))
      check('bare: rule-based insight present', r.json?.meta?.insightSource === 'rules' && r.json?.insight?.recommendation)
      const blocked = await analyse(base, URLS.amazonS24Blocked)
      check('bare: blocked page without search → still JSON (no crash)', blocked.json !== null && (blocked.status === 200 || blocked.status === 422), `${blocked.status}`)
    })
  } finally {
    for (const h of helpers) await stop(h)
    await mocks.close()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log('\nFailures:\n - ' + failures.join('\n - '))
    process.exit(1)
  }
}

async function uiTest(base, wsEndpoint) {
  const puppeteer = (await import('puppeteer-core')).default
  let browser
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint })
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.goto(`${base}/ai-assistant`, { waitUntil: 'load', timeout: 20_000 })
    await page.waitForSelector('input[type="text"]', { timeout: 10_000 })
    await page.type('input[type="text"]', URLS.amazonIphone)
    await page.keyboard.press('Enter')
    // The analysis takes a few seconds; the page then routes to /ai-assistant/analysis
    const end = Date.now() + 45_000
    let text = ''
    while (Date.now() < end) {
      await sleep(1000)
      text = await page.evaluate(() => document.body.innerText || document.body.textContent || '')
      if (/Price Comparison/.test(text)) break
    }
    check('UI: input page → analysis page renders comparison', /Price Comparison/.test(text), text.slice(0, 300))
    check('UI: shows Flipkart price ₹65,999', /65,999/.test(text))
    check('UI: shows AI recommendation text', /Compare with the cheapest store/.test(text))
    await context.close().catch(() => {})
  } catch (err) {
    check('UI: drove the pages with Lightpanda', false, err.message)
  } finally {
    await browser?.disconnect().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
