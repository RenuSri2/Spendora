/**
 * Proxy-backed scraping API tier ("unblocker").
 *
 * Big Indian stores (Amazon, Croma, sometimes Flipkart) block datacenter IPs
 * like Vercel's no matter which browser makes the request — that's an IP
 * reputation problem, not a rendering problem. Scraping APIs route the
 * request through residential / in-country proxies and solve the bot checks,
 * which is the only reliable fix from serverless.
 *
 * Entirely optional. Set SCRAPING_API_KEY (free key) to turn it on.
 * SCRAPING_API_PROVIDER picks the service, default "scraperapi":
 *   scraperapi | scrapedo | scrapfly | zenrows
 *
 * Credit-saving by default: a cheap standard request first, and only if the
 * page is still a bot wall, one retry in premium (residential/anti-bot) mode.
 *   SCRAPING_API_PREMIUM=0  never use premium (cheapest)
 *   SCRAPING_API_PREMIUM=1  always premium (skip the cheap attempt)
 *   SCRAPING_API_RENDER=1   JS rendering on the provider side
 *   SCRAPING_API_COUNTRY    defaults to "in"
 */

export type UnblockerProvider = 'scraperapi' | 'scrapedo' | 'scrapfly' | 'zenrows'

const PROVIDERS: UnblockerProvider[] = ['scraperapi', 'scrapedo', 'scrapfly', 'zenrows']

const DEFAULT_BASE: Record<UnblockerProvider, string> = {
  scraperapi: 'https://api.scraperapi.com/',
  scrapedo: 'https://api.scrape.do/',
  scrapfly: 'https://api.scrapfly.io/scrape',
  zenrows: 'https://api.zenrows.com/v1/',
}

export function unblockerProvider(): UnblockerProvider | null {
  if (!process.env.SCRAPING_API_KEY) return null
  const p = ((process.env.SCRAPING_API_PROVIDER || 'scraperapi').trim().toLowerCase().replace(/[^a-z]/g, '') ||
    'scraperapi') as UnblockerProvider
  return PROVIDERS.includes(p) ? p : null
}

export function unblockerAvailable(): boolean {
  return unblockerProvider() !== null
}

function buildRequest(provider: UnblockerProvider, url: string, timeoutMs: number, premium: boolean): string {
  const key = process.env.SCRAPING_API_KEY as string
  const render = process.env.SCRAPING_API_RENDER === '1'
  const country = (process.env.SCRAPING_API_COUNTRY || 'in').toLowerCase()
  const base = process.env.SCRAPING_API_BASE_URL || DEFAULT_BASE[provider]
  const p = new URLSearchParams()

  switch (provider) {
    case 'scraperapi':
      p.set('api_key', key)
      p.set('url', url)
      p.set('country_code', country)
      if (premium) p.set('premium', 'true')
      if (render) p.set('render', 'true')
      break
    case 'scrapedo':
      p.set('token', key)
      p.set('url', url)
      p.set('geoCode', country)
      if (premium) p.set('super', 'true')
      if (render) p.set('render', 'true')
      break
    case 'scrapfly':
      p.set('key', key)
      p.set('url', url)
      p.set('country', country)
      p.set('lang', 'en-IN,en')
      p.set('timeout', String(Math.max(15000, timeoutMs)))
      if (premium) p.set('asp', 'true')
      if (render) p.set('render_js', 'true')
      break
    case 'zenrows':
      p.set('apikey', key)
      p.set('url', url)
      if (premium) {
        p.set('premium_proxy', 'true')
        p.set('proxy_country', country)
      }
      if (render) p.set('js_render', 'true')
      break
  }
  return `${base}${base.includes('?') ? '&' : '?'}${p.toString()}`
}

/** Which request modes to try, cheapest first. */
export function premiumPlan(): boolean[] {
  const mode = process.env.SCRAPING_API_PREMIUM
  if (mode === '1') return [true]
  if (mode === '0') return [false]
  return [false, true]
}

/** Fetches `url` through the configured scraping API, in one specific mode. */
export async function fetchViaUnblocker(
  url: string,
  timeoutMs = 20_000,
  premium = false
): Promise<{ html: string; provider: UnblockerProvider; premium: boolean }> {
  const provider = unblockerProvider()
  if (!provider) throw new Error('No scraping API configured (set SCRAPING_API_KEY)')

  const res = await fetch(buildRequest(provider, url, timeoutMs, premium), {
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  const body = await res.text()

  if (res.status === 401 || res.status === 403) {
    throw new Error(`${provider}: unauthorized or out of credits (HTTP ${res.status})`)
  }

  if (provider === 'scrapfly') {
    // JSON envelope: result.content is the page, result.status_code the upstream status
    let data: { result?: { content?: string; status_code?: number }; message?: string; code?: string } | null = null
    try {
      data = JSON.parse(body)
    } catch {
      data = null
    }
    const upstream = data?.result?.status_code ?? 0
    if (!res.ok || !data?.result?.content || upstream >= 400) {
      throw new Error(`scrapfly: ${data?.code || data?.message || `HTTP ${res.status}/${upstream}`}`)
    }
    return { html: data.result.content, provider, premium }
  }

  if (!res.ok || !body) {
    throw new Error(`${provider}: HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ''}`)
  }
  return { html: body, provider, premium }
}
