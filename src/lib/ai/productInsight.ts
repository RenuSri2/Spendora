export interface ProductInsight {
  summary: string
  pros: string[]
  cons: string[]
  whoItsFor: string
  recommendation: string
}

export interface InsightResult {
  insight: ProductInsight
  /** 'ai' = written by the HF model; 'rules' = deterministic fallback */
  source: 'ai' | 'rules'
  model?: string
  /** Why the AI path wasn't used (missing token, quota, model unavailable…) */
  error?: string
}

interface PriceContext {
  name: string
  price: number | null
  currency: string
  platform: string
  priceHistory: Array<{ price: number; capturedAt: string }>
  comparison?: Array<{ platform: string; price: number }>
  valueScoreLabel?: string // e.g. "Good time to buy" — computed deterministically, not by the model
  priceSource?: string | null
}

// Hugging Face's OpenAI-compatible router — free tier available on a HF
// account token, no separate SDK needed.
const HF_ROUTER_URL = (process.env.HF_BASE_URL || 'https://router.huggingface.co/v1').replace(/\/+$/, '') + '/chat/completions'

// The old default, google/gemma-4-E4B-it, is not served by ANY inference
// provider on the HF router, so every request failed and the insight was
// always empty. These are Gemma 4 instruct models that providers actually
// serve, plus a widely-hosted non-Gemma fallback. HF_MODEL (comma-separated)
// is tried first.
const DEFAULT_MODELS = [
  'google/gemma-4-26B-A4B-it',
  'google/gemma-4-31B-it',
  'meta-llama/Llama-3.1-8B-Instruct',
]

function modelChain(): string[] {
  const fromEnv = (process.env.HF_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  return [...new Set([...fromEnv, ...DEFAULT_MODELS])]
}

function hfToken(): string | undefined {
  return process.env.HF_API_TOKEN || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY
}

export function hfConfigured(): boolean {
  return Boolean(hfToken())
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

function buildPrompt(ctx: PriceContext): string {
  const historyLine =
    ctx.priceHistory.length > 1
      ? `Price history we've observed for this exact listing: ${ctx.priceHistory
          .slice(-10)
          .map((h) => `${inr(h.price)} on ${new Date(h.capturedAt).toISOString().slice(0, 10)}`)
          .join(', ')}.`
      : `No prior price history yet — this is the first time we've checked this listing.`

  const comparisonLine =
    ctx.comparison && ctx.comparison.length > 0
      ? `We also found this same product for real, confirmed prices elsewhere: ${ctx.comparison
          .slice(0, 8)
          .map((c) => `${inr(c.price)} on ${c.platform}`)
          .join(', ')}.`
      : `We could not confidently find this exact product on other platforms — do not guess or imply a cross-platform comparison exists.`

  const priceLine =
    ctx.price !== null
      ? `Current price: ${inr(ctx.price)} (${ctx.currency})${
          ctx.priceSource === 'search-listing' ? ' — taken from the Google Shopping listing because the store page blocked us' : ''
        }`
      : `Current price on ${ctx.platform}: unknown (the store page blocked price extraction). Do not invent one.`

  const scoreLine = ctx.valueScoreLabel
    ? `A separate, deterministic pricing check already concluded: "${ctx.valueScoreLabel}". Your narrative should be consistent with this, not contradict it.`
    : ''

  return `You are a plain-spoken shopping assistant for Indian shoppers. You only know what's given below — do not invent reviews, ratings, competitor prices, or specs you weren't given.

Product: ${ctx.name}
Platform: ${ctx.platform}
${priceLine}
${historyLine}
${comparisonLine}
${scoreLine}

Based ONLY on this information, respond with strict JSON (no markdown fences, no commentary before or after) in this shape:
{"summary": "two to three sentence honest take on this listing and price", "pros": ["short factual point"], "cons": ["short factual point"], "whoItsFor": "one sentence grounded only in price/platform data", "recommendation": "one to two sentence buy/wait/skip guidance consistent with the pricing check above"}

Up to 4 pros and 4 cons. Fewer is fine — never fabricate specifics you weren't given.`
}

/** Pulls the first balanced JSON object out of model output (handles fences / chatter). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function asStringList(v: unknown, max = 5): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max) : []
}

class FatalHfError extends Error {}

async function callModel(model: string, prompt: string, timeoutMs: number): Promise<ProductInsight> {
  const response = await fetch(HF_ROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300)
    // Token/quota problems won't be fixed by trying another model.
    if (response.status === 401 || response.status === 403 || response.status === 402 || response.status === 429) {
      throw new FatalHfError(`HF ${response.status}: ${body}`)
    }
    throw new Error(`HF ${response.status} (${model}): ${body}`)
  }

  const data = await response.json()
  const text: string | undefined = data?.choices?.[0]?.message?.content
  if (!text) throw new Error(`Empty response from ${model}`)

  const parsed = extractJsonObject(text)
  if (!parsed) throw new Error(`Unparseable JSON from ${model}`)

  const insight: ProductInsight = {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    pros: asStringList(parsed.pros),
    cons: asStringList(parsed.cons),
    whoItsFor: typeof parsed.whoItsFor === 'string' ? parsed.whoItsFor : '',
    recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
  }
  if (!insight.summary && !insight.recommendation) throw new Error(`Empty insight from ${model}`)
  return insight
}

/**
 * Deterministic insight built only from the numbers we have. Used when the
 * HF token is missing, the quota is exhausted, or every model failed — so
 * the page always has a written read, clearly labelled as rule-based.
 */
export function buildRuleBasedInsight(ctx: PriceContext): ProductInsight {
  const pros: string[] = []
  const cons: string[] = []
  const others = (ctx.comparison || []).filter((c) => Number.isFinite(c.price))
  const cheapest = others.length ? others.reduce((a, b) => (b.price < a.price ? b : a)) : null

  if (ctx.price !== null && cheapest) {
    if (ctx.price <= cheapest.price) {
      pros.push(`Cheapest of ${others.length + 1} confirmed listings we found`)
    } else {
      const diff = ctx.price - cheapest.price
      cons.push(`${inr(diff)} more than ${cheapest.platform} (${inr(cheapest.price)})`)
    }
  } else if (ctx.price === null && cheapest) {
    pros.push(`Confirmed listing at ${inr(cheapest.price)} on ${cheapest.platform}`)
    cons.push(`We couldn't read the live price on ${ctx.platform} — check it before buying`)
  } else if (!cheapest) {
    cons.push('No confirmed listings on other platforms to compare against')
  }

  if (ctx.priceHistory.length > 1) {
    const prices = ctx.priceHistory.map((h) => h.price)
    const prev = prices[prices.length - 2]
    const curr = prices[prices.length - 1]
    const low = Math.min(...prices)
    if (curr < prev) pros.push(`Price dropped since our last check (was ${inr(prev)})`)
    if (curr > prev) cons.push(`Price rose since our last check (was ${inr(prev)})`)
    if (curr <= low) pros.push(`Lowest price we've recorded for this listing`)
  } else {
    cons.push('No price history yet — check again later to spot drops')
  }

  if (ctx.priceSource === 'search-listing') {
    cons.push('Price comes from the Google Shopping listing, not the live store page')
  }

  const label = ctx.valueScoreLabel || 'Fair price'
  const priceText = ctx.price !== null ? `${inr(ctx.price)} on ${ctx.platform}` : `an unknown price on ${ctx.platform}`
  const summary =
    `${ctx.name} is listed at ${priceText}. ` +
    (cheapest
      ? `The lowest confirmed price elsewhere is ${inr(cheapest.price)} on ${cheapest.platform}.`
      : `We couldn't confirm this exact product on other stores, so this read is based on this listing alone.`)

  const recommendation =
    label === 'Good time to buy'
      ? 'Price looks good right now — buying here is reasonable.'
      : label === 'Consider waiting'
        ? cheapest && ctx.price !== null && cheapest.price < ctx.price
          ? `Consider buying on ${cheapest.platform} instead, or wait for a drop here.`
          : 'Consider waiting — the price has been better.'
        : 'A fair price, but not a standout deal — buy if you need it now.'

  return {
    summary,
    pros,
    cons,
    whoItsFor: cheapest && ctx.price !== null && cheapest.price < ctx.price
      ? 'Buyers who prefer this platform (delivery, returns, offers) over saving a little elsewhere.'
      : 'Buyers who want this product now at a price in line with what we can verify.',
    recommendation,
  }
}

/**
 * Generates a plain-spoken buying read using only data we actually have:
 * name, current price, platform, real price history, and real matched
 * comparisons. Tries the HF model chain; falls back to the rule-based read
 * so callers always get something to show.
 */
export async function generateProductInsight(
  ctx: PriceContext,
  options: { budgetMs?: number } = {}
): Promise<InsightResult> {
  const fallback = (error: string): InsightResult => ({ insight: buildRuleBasedInsight(ctx), source: 'rules', error })

  if (!hfToken()) return fallback('HF_API_TOKEN not set')

  const deadline = Date.now() + (options.budgetMs ?? 20_000)
  const prompt = buildPrompt(ctx)
  const errors: string[] = []

  for (const model of modelChain()) {
    const remaining = deadline - Date.now()
    if (remaining < 2500) {
      errors.push('time budget exhausted')
      break
    }
    try {
      const insight = await callModel(model, prompt, Math.min(remaining, 15_000))
      return { insight, source: 'ai', model }
    } catch (err) {
      const msg = err instanceof Error ? (err.name === 'TimeoutError' ? `${model} timed out` : err.message) : String(err)
      errors.push(msg)
      console.error('[ai] HF insight attempt failed:', msg)
      if (err instanceof FatalHfError) break
    }
  }

  return fallback(errors.join(' | ') || 'AI generation failed')
}
