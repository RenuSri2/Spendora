export type Platform =
  | 'amazon'
  | 'flipkart'
  | 'myntra'
  | 'nykaa'
  | 'croma'
  | 'generic'

export interface ProductResult {
  success: boolean
  platform: Platform
  url: string
  name: string | null
  price: number | null
  currency: string
  image: string | null
  // which layer produced the data — useful for debugging accuracy over time
  source: 'json-ld' | 'og-meta' | 'platform-selector' | null
  // true if the plain fetch() was blocked/insufficient and we had to fall
  // back to a real headless browser to render the page
  renderedWithBrowser?: boolean
  error?: string
}

export interface ExtractedRaw {
  name?: string | null
  price?: number | null
  currency?: string
  image?: string | null
}
