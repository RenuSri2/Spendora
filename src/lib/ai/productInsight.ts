export interface ProductInsight {
  summary: string
  pros: string[]
  cons: string[]
  whoItsFor: string
  recommendation: string
}

interface PriceContext {
  name: string
  price: number
  currency: string
  platform: string
  priceHistory: Array<{ price: number; capturedAt: string }>
  comparison?: Array<{ platform: string; price: number }>
  valueScoreLabel?: string // e.g. "Good time to buy" — computed deterministically, not by the model
}

// Hugging Face's OpenAI-compatible router — free tier available on a HF
// account token, no separate SDK needed. Model is overridable via env in
// case a given model/provider combo is unavailable or you want something
// bigger; defaults to a small Gemma 4 instruct variant that's cheap on the
// free quota.
const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions'
const HF_MODEL = process.env.HF_MODEL || 'google/gemma-4-E4B-it'

/**
 * Generates a plain-spoken buying read using only data we actually have:
 * name, current price, platform, real price history, and real matched
 * comparisons. Deliberately does NOT ask the model to invent reviews,
 * ratings, or competitor prices it wasn't given — the model has no access
 * to those and fabricating them is exactly the problem this replaces.
 *
 * The value-score LABEL (not the model's own opinion) is passed in so the
 * model's narrative doesn't contradict the deterministic score computed in
 * scoring.ts — the model explains/contextualizes a real number rather than
 * inventing its own verdict from scratch.
 */
export async function generateProductInsight(
  ctx: PriceContext
): Promise<ProductInsight | null> {
  if (!process.env.HF_API_TOKEN) {
    return null
  }

  const historyLine =
    ctx.priceHistory.length > 1
      ? `Price history we've observed for this exact listing: ${ctx.priceHistory
          .map((h) => `₹${h.price} on ${new Date(h.capturedAt).toLocaleDateString()}`)
          .join(', ')}.`
      : `No prior price history yet — this is the first time we've checked this listing.`

  const comparisonLine =
    ctx.comparison && ctx.comparison.length > 0
      ? `We also found this same product for real, confirmed prices on other platforms: ${ctx.comparison
          .map((c) => `₹${c.price} on ${c.platform}`)
          .join(', ')}.`
      : `We could not confidently find this exact product on other platforms — do not guess or imply a cross-platform comparison exists.`

  const scoreLine = ctx.valueScoreLabel
    ? `A separate, deterministic pricing check already concluded: "${ctx.valueScoreLabel}". Your narrative should be consistent with this, not contradict it — you're explaining the reasoning in plain language, not producing your own independent verdict.`
    : ''

  const prompt = `You are a plain-spoken shopping assistant. You only know what's given below — do not invent reviews, ratings, competitor prices, or specs you weren't given.

Product: ${ctx.name}
Platform: ${ctx.platform}
Current price: ₹${ctx.price} ${ctx.currency}
${historyLine}
${comparisonLine}
${scoreLine}

Based ONLY on this information, respond with strict JSON (no markdown fences, no commentary before or after) in this shape:
{
  "summary": "two to three sentence honest take on this specific listing and price",
  "pros": ["short factual point", ...up to 5],
  "cons": ["short factual point", ...up to 5],
  "whoItsFor": "one sentence on what kind of buyer this price/platform makes sense for, grounded only in price/platform data — not invented use-cases",
  "recommendation": "one to two sentence buy/wait/skip guidance consistent with the pricing check above"
}

If you don't have enough information for a pro/con, it's fine to return fewer than 5 — never fabricate specifics you weren't given. If there's nothing meaningful to say for whoItsFor beyond price, keep it brief rather than inventing detail.`

  try {
    const response = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      console.error('HF inference request failed:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text: string | undefined = data?.choices?.[0]?.message?.content

    if (!text) return null

    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      summary: parsed.summary || '',
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
      whoItsFor: parsed.whoItsFor || '',
      recommendation: parsed.recommendation || '',
    }
  } catch (error) {
    console.error('HF insight generation failed:', error)
    return null
  }
}
