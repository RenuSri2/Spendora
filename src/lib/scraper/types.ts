export type Platform =
  | 'amazon'
  | 'flipkart'
  | 'myntra'
  | 'nykaa'
  | 'croma'
  | 'generic'

export type DataSource =
  | 'json-ld'
  | 'og-meta'
  | 'platform-selector'
  // Not scraped from the page itself: the listing's price as Google Shopping
  // reports it (via Serper). Used only when the page blocked us.
  | 'search-listing'

export interface ProductResult {
  success: boolean
  platform: Platform
  url: string
  /** URL after redirects (short links like amzn.in/d/… resolve here) */
  finalUrl?: string
  name: string | null
  price: number | null
  currency: string
  image: string | null
  // which layer produced the data — useful for debugging accuracy over time
  source: DataSource | null
  // true if plain fetch() was blocked/insufficient and the page had to be
  // rendered by Lightpanda instead
  renderedWithBrowser?: boolean
  renderBackend?: string
  /** true if the site served a bot-check / CAPTCHA page */
  blocked?: boolean
  error?: string
}

export interface ExtractedRaw {
  name?: string | null
  price?: number | null
  currency?: string
  image?: string | null
}
