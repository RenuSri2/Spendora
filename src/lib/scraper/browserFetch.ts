import type { Browser, Page } from 'puppeteer'
import { pickUserAgent } from './headers'

// Lazily-launched, reused across calls within the same warm server instance.
// A cold browser launch is expensive (~1-3s), so we don't want to pay that
// cost per request — but we also don't want a browser hanging around
// forever, so it's torn down after a period of inactivity.
let browserPromise: Promise<Browser> | null = null
let idleTimer: NodeJS.Timeout | null = null
const IDLE_SHUTDOWN_MS = 60_000

function scheduleIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(async () => {
    if (browserPromise) {
      try {
        const browser = await browserPromise
        await browser.close()
      } catch {
        // already gone, ignore
      }
      browserPromise = null
    }
  }, IDLE_SHUTDOWN_MS)
}

async function launchBrowser(): Promise<Browser> {
  // Two code paths on purpose:
  //  - Vercel/AWS Lambda (or any serverless env): bundled Chromium is too
  //    big to ship in a function, so we use @sparticuz/chromium's trimmed
  //    binary + puppeteer-core instead.
  //  - Everywhere else (local dev, a VPS, Docker): full `puppeteer` already
  //    downloads its own Chromium at install time, so just use that.
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteerCore = (await import('puppeteer-core')).default
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Promise<Browser>
  }

  const puppeteerExtra = (await import('puppeteer-extra')).default
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default
  puppeteerExtra.use(StealthPlugin())
  return puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser()
  }
  return browserPromise
}

const NAV_TIMEOUT_MS = 20_000

/**
 * Renders `url` in a real (stealth-patched) headless browser and returns the
 * fully-rendered HTML. This is the fallback tier for when plain `fetch()`
 * gets blocked (403/503) or returns a CAPTCHA/bot-check page — it costs
 * several seconds and real CPU, so callers should only reach for it after
 * the cheap fetch path has already failed.
 */
export async function fetchHtmlWithBrowser(url: string): Promise<string> {
  const browser = await getBrowser()
  let page: Page | null = null

  try {
    page = await browser.newPage()

    await page.setUserAgent(pickUserAgent())
    await page.setViewport({
      width: 1280 + Math.floor(Math.random() * 200),
      height: 800 + Math.floor(Math.random() * 200),
    })
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8' })

    // Block heavy assets we don't need — faster page loads, less bandwidth,
    // and fewer things that can time out. We still need CSS/JS for the page
    // to render its price into the DOM, so only images/fonts/media are cut.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      if (type === 'image' || type === 'font' || type === 'media') {
        req.abort()
      } else {
        req.continue()
      }
    })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    })

    // Give client-side rendered price widgets a moment to settle. A fixed
    // small wait rather than networkidle0 — these sites keep background
    // polling/analytics connections open, so networkidle0 can hang.
    await new Promise((resolve) => setTimeout(resolve, 1500))

    return await page.content()
  } finally {
    if (page) await page.close().catch(() => {})
    scheduleIdleShutdown()
  }
}
