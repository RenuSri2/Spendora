import { Platform } from './types'

export function detectPlatform(url: string): Platform {
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return 'generic'
  }

  if (hostname.includes('amazon.')) return 'amazon'
  if (hostname.includes('flipkart.')) return 'flipkart'
  if (hostname.includes('myntra.')) return 'myntra'
  if (hostname.includes('nykaa.')) return 'nykaa'
  if (hostname.includes('croma.')) return 'croma'
  return 'generic'
}
