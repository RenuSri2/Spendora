import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

/**
 * JS-rendering fallback tier, powered by Lightpanda (a lightweight headless
 * browser written in Zig — no Chrome/Chromium anywhere in this project).
 *
 * Plain fetch() is always tried first (see index.ts). This module is only hit
 * when that fails or returns a page with no product data. Three backends are
 * supported and tried in this order — whichever is configured:
 *
 *  1. SCRAPER_SERVER_URL   — our own tiny render server (see /scraper-server),
 *                            e.g. deployed free on Hugging Face Spaces. Best
 *                            option for Vercel: no binary in the function.
 *  2. LIGHTPANDA_WS_URL or — any Lightpanda CDP endpoint (Lightpanda Cloud,
 *     LIGHTPANDA_TOKEN       a self-hosted `lightpanda serve`, Railway, …),
 *                            driven with puppeteer-core over a WebSocket.
 *  3. Local binary         — LIGHTPANDA_EXECUTABLE_PATH, or the binary that
 *                            `npx @lightpanda/browser install` drops into
 *                            ~/.cache/lightpanda-node. Used on a VPS/Docker or
 *                            in local dev. Never assumed on serverless.
 *
 * If none are configured the tier is skipped cleanly (renderAvailable() is
 * false) — the rest of the pipeline (fetch + search-based comparison + AI)
 * keeps working.
 */

export type RenderBackend = 'render-server' | 'lightpanda-cdp' | 'lightpanda-local'

export interface RenderResult {
  html: string
  backend: RenderBackend
  finalUrl?: string
}

const DEFAULT_RENDER_TIMEOUT_MS = 15_000

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
}

function cdpEndpoint(): string | null {
  if (process.env.LIGHTPANDA_WS_URL) return process.env.LIGHTPANDA_WS_URL
  if (process.env.LIGHTPANDA_TOKEN) {
    const region = process.env.LIGHTPANDA_REGION // e.g. "euwest" | "uswest" — optional
    const host = region ? `${region}.cloud.lightpanda.io` : 'cloud.lightpanda.io'
    const params = new URLSearchParams({ token: process.env.LIGHTPANDA_TOKEN })
    if (process.env.LIGHTPANDA_PROXY) params.set('proxy', process.env.LIGHTPANDA_PROXY)
    if (process.env.LIGHTPANDA_COUNTRY) params.set('country', process.env.LIGHTPANDA_COUNTRY)
    return `wss://${host}/ws?${params.toString()}`
  }
  return null
}

export function localLightpandaPath(): string | null {
  const candidates = [
    process.env.LIGHTPANDA_EXECUTABLE_PATH,
    path.join(homedir(), '.cache', 'lightpanda-node', 'lightpanda'),
    '/usr/local/bin/lightpanda',
    '/usr/bin/lightpanda',
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Which render backends are configured right now, in the order they're tried. */
export function availableBackends(): RenderBackend[] {
  if (process.env.BROWSER_RENDER === 'off') return []
  const backends: RenderBackend[] = []
  if (process.env.SCRAPER_SERVER_URL) backends.push('render-server')
  if (cdpEndpoint()) backends.push('lightpanda-cdp')
  // A local binary on serverless only counts if someone explicitly pointed at one.
  if (localLightpandaPath() && (!isServerless() || process.env.LIGHTPANDA_EXECUTABLE_PATH)) {
    backends.push('lightpanda-local')
  }
  return backends
}

export function renderAvailable(): boolean {
  return availableBackends().length > 0
}

// ---------------------------------------------------------------------------
// Backend 1: HTTP render server (scraper-server/, deployable to HF Spaces)
// ---------------------------------------------------------------------------
async function renderViaServer(url: string, timeoutMs: number): Promise<RenderResult> {
  const base = process.env.SCRAPER_SERVER_URL!.replace(/\/+$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SERVER_TOKEN) headers.Authorization = `Bearer ${process.env.SCRAPER_SERVER_TOKEN}`

  const res = await fetch(`${base}/render`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, timeoutMs: Math.max(3000, timeoutMs - 2000) }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = (await res.json().catch(() => null)) as { html?: string; error?: string; finalUrl?: string } | null
  if (!res.ok || !data?.html) {
    throw new Error(`Render server failed (HTTP ${res.status})${data?.error ? `: ${data.error}` : ''}`)
  }
  return { html: data.html, backend: 'render-server', finalUrl: data.finalUrl }
}

// ---------------------------------------------------------------------------
// Backend 2: Lightpanda over CDP (cloud or self-hosted `lightpanda serve`)
// ---------------------------------------------------------------------------
async function renderViaCdp(url: string, timeoutMs: number): Promise<RenderResult> {
  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.connect({ browserWSEndpoint: cdpEndpoint()!, protocolTimeout: timeoutMs })
  try {
    const context = await browser.createBrowserContext()
    try {
      const page = await context.newPage()
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8' }).catch(() => {})
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs })
      // Let client-rendered price widgets settle without waiting on
      // analytics connections that never go idle.
      await new Promise((r) => setTimeout(r, 1000))
      const html = await page.content()
      return { html, backend: 'lightpanda-cdp', finalUrl: page.url() }
    } finally {
      await context.close().catch(() => {})
    }
  } finally {
    await browser.disconnect().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Backend 3: local Lightpanda binary, one-shot `lightpanda fetch`
// ---------------------------------------------------------------------------
export function runLightpandaFetch(
  binary: string,
  url: string,
  timeoutMs: number,
  extraArgs: string[] = []
): Promise<{ html: string; finalUrl?: string }> {
  // 'done' waits for scripts/timers/network to go quiet (so client-rendered
  // prices land in the DOM); busy pages just run to --wait-ms instead.
  const waitMs = Math.min(6000, Math.max(2000, timeoutMs - 3000))
  const args = [
    'fetch',
    '--dump', 'html',
    '--json',
    '--wait-until', 'done',
    '--wait-ms', String(waitMs),
    '--terminate-ms', String(waitMs + 1000),
    '--strip-mode', 'css',
    '--locale', 'en-IN',
    // Lightpanda uses its own honest User-Agent; it rejects browser impersonation.
    '--http-header', 'Accept-Language: en-IN,en;q=0.9',
    '--log-level', 'fatal',
    // SSRF guard: user-supplied URLs must not reach internal addresses.
    ...(process.env.LIGHTPANDA_ALLOW_PRIVATE === '1' ? [] : ['--block-private-networks']),
    ...extraArgs,
    url,
  ]
  // Optional egress proxy / custom CA for Lightpanda (it doesn't read
  // HTTPS_PROXY). Note --ca-cert REPLACES the system trust store.
  if (process.env.LIGHTPANDA_HTTP_PROXY) args.splice(1, 0, '--http-proxy', process.env.LIGHTPANDA_HTTP_PROXY)
  const caBundle = process.env.LIGHTPANDA_CA_CERT
  if (caBundle && existsSync(caBundle)) args.splice(1, 0, '--ca-cert', caBundle)

  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' } },
      (err, stdout) => {
        // With --json, stdout carries {url, status, error, ...dump} even on failure.
        let parsed: { content?: string; url?: string; error?: string | null; http_status?: number; bot_challenge?: unknown } | null = null
        try {
          parsed = JSON.parse(stdout)
        } catch {
          parsed = null
        }
        if (parsed && parsed.http_status === 0) {
          reject(new Error(`Lightpanda: ${parsed.error || 'navigation failed (could not connect)'}`))
          return
        }
        const html = parsed?.content
        if (typeof html === 'string' && html.length > 0) {
          resolve({ html, finalUrl: parsed?.url })
          return
        }
        if (!parsed && stdout && /<html|<body|<head/i.test(stdout)) {
          resolve({ html: stdout })
          return
        }
        reject(new Error(parsed?.error ? `Lightpanda: ${parsed.error}` : err ? `Lightpanda: ${err.message}` : 'Lightpanda returned no HTML'))
      }
    )
  })
}

async function renderViaLocal(url: string, timeoutMs: number): Promise<RenderResult> {
  const binary = localLightpandaPath()
  if (!binary) throw new Error('Lightpanda binary not found')
  const { html, finalUrl } = await runLightpandaFetch(binary, url, timeoutMs)
  return { html, backend: 'lightpanda-local', finalUrl }
}

/**
 * Renders `url` with whichever Lightpanda backend is configured, falling
 * through to the next backend if one fails. Throws if none are configured
 * or all fail — callers treat that as "browser tier unavailable".
 */
export async function renderHtml(url: string, timeoutMs = DEFAULT_RENDER_TIMEOUT_MS): Promise<RenderResult> {
  const backends = availableBackends()
  if (backends.length === 0) {
    throw new Error('No browser renderer configured (set SCRAPER_SERVER_URL, LIGHTPANDA_TOKEN or LIGHTPANDA_EXECUTABLE_PATH)')
  }

  const errors: string[] = []
  for (const backend of backends) {
    try {
      if (backend === 'render-server') return await renderViaServer(url, timeoutMs)
      if (backend === 'lightpanda-cdp') return await renderViaCdp(url, timeoutMs)
      return await renderViaLocal(url, timeoutMs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${backend}: ${msg}`)
      console.warn(`[renderer] ${backend} failed for ${url}: ${msg}`)
    }
  }
  throw new Error(errors.join(' | '))
}
