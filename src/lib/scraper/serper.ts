export interface SearchResult {
  title: string
  url: string
  content: string
}

const SERPER_URL = 'https://google.serper.dev/search'

/**
 * Runs a Google search via Serper.dev and returns organic results in the
 * same shape SearXNG used to, so nothing downstream (match.ts, compare.ts,
 * discover.ts) needs to change. Site-restricted searches just use a
 * `site:domain.com query` string, same as before.
 */
export async function searchSerper(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.error('Serper request failed:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const organic: Array<{ title?: string; link?: string; snippet?: string }> = data.organic || []

    return organic
      .filter((r) => typeof r.link === 'string')
      .map((r) => ({
        title: r.title || '',
        url: r.link as string,
        content: r.snippet || '',
      }))
  } catch (error) {
    console.error('Serper request error:', error)
    return []
  }
}
