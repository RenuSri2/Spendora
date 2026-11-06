import { Platform } from './types'

export function detectPlatform(url: string): Platform {
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return 'generic'
  }

  if (hostname.includes('amazon.') || hostname === 'amzn.in' || hostname === 'amzn.to' || hostname === 'a.co') return 'amazon'
  if (hostname.includes('flipkart.') || hostname === 'fkrt.it' || hostname === 'fkrt.co') return 'flipkart'
  if (hostname.includes('myntra.')) return 'myntra'
  if (hostname.includes('nykaa.')) return 'nykaa'
  if (hostname.includes('croma.')) return 'croma'
  return 'generic'
}
