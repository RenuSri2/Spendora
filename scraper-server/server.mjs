// Spendora render server — renders product pages with Lightpanda and returns
// the HTML. Zero npm dependencies. Deploy it anywhere that runs Docker
// (Hugging Face Spaces free tier works: see README.md in this folder), then
// point the Next.js app at it with SCRAPER_SERVER_URL + SCRAPER_SERVER_TOKEN.
//
//   GET  /         → health + Lightpanda version
//   POST /render   → { url, timeoutMs? }  ⇒  { html, finalUrl, status, botChallenge }
//
// Auth: if SCRAPER_SERVER_TOKEN is set, requests need
// "Authorization: Bearer <token>". Always set it on a public deployment.

import http from 'node:http'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = Number(process.env.PORT) || 7860
const TOKEN = process.env.SCRAPER_SERVER_TOKEN || ''
const BINARY = process.env.LIGHTPANDA_EXECUTABLE_PATH || '/usr/local/bin/lightpanda'
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY) || 4
const MAX_TIMEOUT_MS = 25_000
// Pages may not reach private/internal addresses (SSRF guard). Tests can
// turn this off to render pages served on localhost.
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE_NETWORKS === '1'

// Lightpanda sends its own honest User-Agent (it refuses to impersonate
// Chrome/Safari), so there's no UA rotation here.

let lightpandaVersion = 'unknown'
try {
  lightpandaVersion = execFileSync(BINARY, ['version'], { timeout: 5000 }).toString().trim()
} catch {
  console.error(`[render-server] Lightpanda binary not runnable at ${BINARY}`)
}

// --- tiny concurrency gate -------------------------------------------------
let active = 0
const queue = []
function acquire() {
  if (active < MAX_CONCURRENCY) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}
function release() {
  const next = queue.shift()
  if (next) next()
  else active--
}

function render(url, timeoutMs) {
  const waitMs = Math.min(8000, Math.max(2000, timeoutMs - 3000))
  const args = [
    'fetch',
    '--dump', 'html',
    '--json',
    '--wait-until', 'done',
    '--wait-ms', String(waitMs),
    '--terminate-ms', String(waitMs + 1000),
    '--strip-mode', 'css',
    '--locale', 'en-IN',
    '--http-header', 'Accept-Language: en-IN,en;q=0.9',
    '--log-level', 'fatal',
  ]
  if (!ALLOW_PRIVATE) args.push('--block-private-networks')
  if (process.env.LIGHTPANDA_HTTP_PROXY) args.push('--http-proxy', process.env.LIGHTPANDA_HTTP_PROXY)
  args.push(url)

  return new Promise((resolve, reject) => {
    execFile(
      BINARY,
      args,
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' } },
      (err, stdout) => {
        let parsed = null
        try {
          parsed = JSON.parse(stdout)
        } catch {
          parsed = null
        }
        // http_status 0 = navigation never happened (DNS/connect failure or a
        // blocked private address); Lightpanda then dumps a stub error page.
        if (parsed && parsed.http_status === 0) {
          reject(new Error(parsed.error || 'Navigation failed (could not connect)'))
          return
        }
        if (parsed && typeof parsed.content === 'string' && parsed.content.length > 0) {
          resolve({
            html: parsed.content,
            finalUrl: parsed.url || url,
            status: parsed.http_status ?? null,
            botChallenge: parsed.bot_challenge ?? null,
          })
          return
        }
        reject(new Error(parsed?.error || (err ? err.message : 'Lightpanda returned no HTML')))
      }
    )
  })
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      return send(res, 200, { ok: existsSync(BINARY), engine: 'lightpanda', version: lightpandaVersion, active, queued: queue.length })
    }

    if (req.method === 'POST' && req.url === '/render') {
      if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
        return send(res, 401, { error: 'Unauthorized' })
      }
      let payload
      try {
        payload = JSON.parse(await readBody(req))
      } catch {
        return send(res, 400, { error: 'Body must be JSON: {"url": "https://…"}' })
      }
      let target
      try {
        target = new URL(String(payload.url))
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error('bad protocol')
      } catch {
        return send(res, 400, { error: 'A valid http(s) url is required' })
      }
      const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(3000, Number(payload.timeoutMs) || 15_000))

      await acquire()
      const started = Date.now()
      try {
        const result = await render(target.toString(), timeoutMs)
        console.log(`[render-server] ${target.hostname} ok ${Date.now() - started}ms`)
        return send(res, 200, { ...result, tookMs: Date.now() - started })
      } catch (err) {
        console.warn(`[render-server] ${target.hostname} failed: ${err.message}`)
        return send(res, 502, { error: err.message, tookMs: Date.now() - started })
      } finally {
        release()
      }
    }

    send(res, 404, { error: 'Not found' })
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[render-server] listening on :${PORT} (lightpanda ${lightpandaVersion}, auth ${TOKEN ? 'on' : 'OFF'})`)
})
