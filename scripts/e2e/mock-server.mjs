// Mock world for the end-to-end test:
//   :STORE_PORT  fake store pages, routed by Host header (www.amazon.in, www.flipkart.com, …)
//   :API_PORT    fake Serper (/search, /shopping) and fake HF router (/hf/v1/chat/completions)
//
// Store hostnames must resolve to 127.0.0.1 (see run.mjs for the /etc/hosts line).

import http from 'node:http'

export const STORE_PORT = Number(process.env.E2E_STORE_PORT) || 8080
export const API_PORT = Number(process.env.E2E_API_PORT) || 9100

const S = (host, path) => `http://${host}:${STORE_PORT}${path}`

export const URLS = {
  amazonIphone: S('www.amazon.in', '/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY'),
  amazonS24Blocked: S('www.amazon.in', '/Samsung-Galaxy-S24-5G-Onyx-Black-256GB/dp/B0CS5XW6TN'),
  flipkartIphoneJs: S('www.flipkart.com', '/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4'),
  flipkartS24: S('www.flipkart.com', '/samsung-galaxy-s24-5g-onyx-black-256-gb/p/itmabc'),
  cromaIphoneBlocked: S('www.croma.com', '/apple-iphone-15-128gb-black/p/300652'),
  relianceIphone: S('www.reliancedigital.in', '/apple-iphone-15-128-gb-black/p/493839'),
  usdIphone: S('www.usd-gadgets.com', '/products/iphone-15-128'),
  indieKettle: S('www.indie-store.in', '/products/steel-electric-kettle-1-5l'),
}

const page = (title, body, head = '') =>
  `<!DOCTYPE html><html><head><title>${title}</title>${head}</head><body>${body}</body></html>`

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`

const CAPTCHA = page('Robot Check', '<p>Enter the characters you see below. Sorry, we just need to make sure you\'re not a robot.</p>')

// What a residential-proxy scraping API "sees": the real page instead of the bot wall.
function unblockedRoute(host, path, premium) {
  // Amazon only lets residential (premium) requests through; Croma lets the standard tier in.
  if (host === 'www.amazon.in' && path.startsWith('/Samsung-Galaxy-S24') && premium) {
    return [200, page('Samsung Galaxy S24 5G : Amazon.in',
      `<span id="productTitle">Samsung Galaxy S24 5G (Onyx Black, 8GB, 256GB Storage)</span>
       <span class="a-price priceToPay"><span class="a-offscreen">₹73,499.00</span></span>`)]
  }
  if (host === 'www.croma.com') {
    return [200, page('Apple iPhone 15 128GB Black', '<h1 class="pdp-e-i-head">Apple iPhone 15 (128GB, Black)</h1><span class="amount">₹66,290</span>')]
  }
  return storeRoute(host, path)
}

export const unblockCalls = []

function storeRoute(host, path) {
  if (host === 'www.amazon.in' && path.startsWith('/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY')) {
    // Amazon PDP markup: MRP is .a-text-price, selling price is .priceToPay
    return [200, page('Apple iPhone 15 (128 GB) - Black : Amazon.in',
      `<span id="productTitle"> Apple iPhone 15 (128 GB) - Black </span>
       <div id="corePriceDisplay_desktop_feature_div">
         <span class="a-price a-text-price"><span class="a-offscreen">₹79,900.00</span></span>
         <span class="a-price priceToPay"><span class="a-offscreen">₹69,900.00</span></span>
       </div>
       <img id="landingImage" src="https://m.media-amazon.com/images/I/iphone15.jpg">`,
      jsonLd({ '@type': 'Product', name: 'Apple iPhone 15 (128 GB) - Black', offers: { price: '79900', priceCurrency: 'INR' } }))]
  }
  if (host === 'www.amazon.in' && path.startsWith('/Samsung-Galaxy-S24')) {
    return [503, CAPTCHA]
  }
  if (host === 'www.flipkart.com' && path.startsWith('/apple-iphone-15-black-128-gb')) {
    // Client-rendered: price only exists after JS runs → needs Lightpanda.
    return [200, page('Apple iPhone 15 ( 128 GB Storage ) Online at Best Price On Flipkart.com',
      `<div id="root">Loading…</div>
       <script>
         setTimeout(function () {
           document.getElementById('root').innerHTML =
             '<h1><span class="VU-ZEz">Apple iPhone 15 (Black, 128 GB)</span></h1>' +
             '<div class="Nx9bqj CxhGGd">₹65,999</div><div class="yRaY8j">₹79,900</div>';
         }, 300);
       </script>`)]
  }
  if (host === 'www.flipkart.com' && path.startsWith('/samsung-galaxy-s24')) {
    return [200, page('Samsung Galaxy S24 5G', `<h1><span class="VU-ZEz">SAMSUNG Galaxy S24 5G (Onyx Black, 256 GB) (8 GB RAM)</span></h1><div class="Nx9bqj CxhGGd">₹72,999</div>`)]
  }
  if (host === 'www.croma.com') return [403, CAPTCHA]
  if (host === 'www.reliancedigital.in') {
    return [200, page('Apple iPhone 15 128 GB Black', '<h1>Apple iPhone 15 128 GB, Black</h1>',
      jsonLd({ '@context': 'https://schema.org', '@graph': [{ '@type': 'BreadcrumbList' }, { '@type': 'Product', name: 'Apple iPhone 15 128 GB, Black', image: { url: 'https://example.com/i.jpg' }, offers: { '@type': 'AggregateOffer', lowPrice: '67,900.00', priceCurrency: 'INR' } }] }))]
  }
  if (host === 'www.usd-gadgets.com') {
    return [200, page('Apple iPhone 15 128GB Black', '', jsonLd({ '@type': 'Product', name: 'Apple iPhone 15 128GB Black', offers: { price: '799.00', priceCurrency: 'USD' } }))]
  }
  if (host === 'www.indie-store.in') {
    return [200, page('Steel Electric Kettle 1.5L', '<h1>Steel Electric Kettle 1.5L</h1>',
      `<meta property="og:title" content="Steel Electric Kettle 1.5L"><meta property="product:price:amount" content="Rs. 1,299"><meta property="product:price:currency" content="INR">`)]
  }
  return [404, page('Not found', 'Not found')]
}

// ---------------- fake Serper ----------------
function has(q, ...words) {
  const l = q.toLowerCase()
  return words.every((w) => l.includes(w))
}

function serperSearch(q) {
  const organic = []
  if (has(q, 'b0cs5xw6tn')) {
    organic.push({ title: 'Samsung Galaxy S24 5G (Onyx Black, 8GB, 256GB Storage) : Amazon.in: Electronics', link: URLS.amazonS24Blocked, snippet: 'Samsung Galaxy S24…' })
  }
  if (has(q, 'site:flipkart.com', 'iphone 15')) {
    organic.push({ title: 'Apple iPhone 15 (Black, 128 GB) - Flipkart.com', link: URLS.flipkartIphoneJs, snippet: '' })
    organic.push({ title: 'Apple iPhone 15 (Blue, 256 GB) - Flipkart.com', link: S('www.flipkart.com', '/apple-iphone-15-blue-256-gb/p/x'), snippet: '' })
  }
  if (has(q, 'site:flipkart.com', 'galaxy s24')) {
    organic.push({ title: 'SAMSUNG Galaxy S24 5G (Onyx Black, 256 GB) (8 GB RAM)', link: URLS.flipkartS24, snippet: '' })
  }
  if (has(q, 'site:croma.com', 'iphone 15')) {
    organic.push({ title: 'Apple iPhone 15 (128GB, Black) - Croma', link: URLS.cromaIphoneBlocked, snippet: '' })
  }
  if (has(q, 'site:amazon.in', 'iphone 15')) {
    organic.push({ title: 'Apple iPhone 15 (128 GB) - Black : Amazon.in', link: URLS.amazonIphone, snippet: '' })
  }
  if (has(q, 'buy', 'iphone 15')) {
    organic.push(
      { title: 'Apple iPhone 15 - Wikipedia', link: 'https://en.wikipedia.org/wiki/IPhone_15', snippet: '' },
      { title: 'Buy Apple iPhone 15 128 GB Black Online', link: URLS.relianceIphone, snippet: '' },
      { title: 'Apple iPhone 15 128GB Black', link: URLS.usdIphone, snippet: '' },
      { title: 'Apple iPhone 15 (128 GB) - Black : Amazon.in', link: URLS.amazonIphone, snippet: '' }
    )
  }
  return { organic }
}

function serperShopping(q) {
  const shopping = []
  if (has(q, 'iphone 15')) {
    shopping.push(
      { title: 'Apple iPhone 15 (128 GB) - Black', source: 'Amazon.in', link: URLS.amazonIphone, price: '₹69,900.00' },
      { title: 'Apple iPhone 15 (Black, 128 GB)', source: 'Flipkart', link: URLS.flipkartIphoneJs, price: '₹65,999.00' },
      { title: 'Apple iPhone 15 128GB Black', source: 'Croma', link: URLS.cromaIphoneBlocked, price: '₹66,490.00' },
      { title: 'Apple iPhone 15 128 GB, Black', source: 'Reliance Digital', link: URLS.relianceIphone, price: '₹67,900.00' },
      { title: 'Apple iPhone 15 128GB Black', source: 'Vijay Sales', link: 'https://www.vijaysales.com/apple-iphone-15-128gb-black', price: '₹66,999.00' },
      { title: 'Apple iPhone 15 Pro 256GB Natural Titanium', source: 'Vijay Sales', link: 'https://www.vijaysales.com/apple-iphone-15-pro', price: '₹1,29,900.00' },
      { title: 'Spigen Ultra Hybrid Back Case for Apple iPhone 15', source: 'Amazon.in', link: 'https://www.amazon.in/spigen-case', price: '₹1,499.00' },
      { title: 'Apple iPhone 15 128GB Black', source: 'Best Buy', link: 'https://www.bestbuy.com/iphone-15', price: '$799.99' }
    )
  }
  if (has(q, 'galaxy s24')) {
    shopping.push(
      { title: 'Samsung Galaxy S24 5G (Onyx Black, 8GB, 256GB Storage)', source: 'Amazon.in', link: URLS.amazonS24Blocked, price: '₹74,999.00' },
      { title: 'SAMSUNG Galaxy S24 5G (Onyx Black, 256 GB)', source: 'Flipkart', link: URLS.flipkartS24, price: '₹72,999.00' },
      { title: 'Samsung Galaxy S24 Ultra 5G 256GB', source: 'Croma', link: 'https://www.croma.com/s24-ultra', price: '₹1,21,999.00' }
    )
  }
  return { shopping }
}

// ---------------- fake HF router ----------------
export const hfCalls = []
function hfChat(body, auth) {
  hfCalls.push({ model: body.model, auth })
  if (auth === 'Bearer bad-token') return [401, { error: 'Invalid credentials in Authorization header' }]
  if (body.model === 'google/gemma-4-26B-A4B-it') {
    // Simulate a provider outage for the first model in the chain
    return [503, { error: 'Model google/gemma-4-26B-A4B-it is currently unavailable' }]
  }
  const prompt = body.messages?.[0]?.content || ''
  const product = (prompt.match(/Product: (.*)/) || [])[1] || 'this product'
  const content =
    'Sure! Here is the analysis:\n```json\n' +
    JSON.stringify({
      summary: `${product} is competitively priced based on the listings we found.`,
      pros: ['Confirmed price data across several stores', 'Price is within the normal range'],
      cons: ['Cheaper elsewhere'],
      whoItsFor: 'Shoppers comparing prices before buying.',
      recommendation: 'Compare with the cheapest store before you buy.',
    }) +
    '\n```'
  return [200, { choices: [{ message: { role: 'assistant', content } }], model: body.model }]
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

export function startMocks() {
  const store = http.createServer((req, res) => {
    const host = (req.headers.host || '').split(':')[0]
    const [status, html] = storeRoute(host, req.url || '/')
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })

  const api = http.createServer(async (req, res) => {
    const body = await readJson(req)
    let status = 404
    let payload = { error: 'not found' }
    if (req.url === '/search' || req.url === '/shopping') {
      if (req.headers['x-api-key'] !== 'test-serper-key') {
        status = 403
        payload = { message: 'Unauthorized' }
      } else {
        status = 200
        payload = req.url === '/search' ? serperSearch(body.q || '') : serperShopping(body.q || '')
      }
    } else if (req.url.startsWith('/scrapingapi/') || req.url.startsWith('/scrapfly')) {
      // ScraperAPI-style (raw HTML) and Scrapfly-style (JSON envelope) unblockers
      const u = new URL(req.url, 'http://x')
      const key = u.searchParams.get('api_key') || u.searchParams.get('key')
      const target = new URL(u.searchParams.get('url') || 'http://invalid/')
      const premium = u.searchParams.get('premium') === 'true' || u.searchParams.get('asp') === 'true'
      unblockCalls.push({ provider: req.url.startsWith('/scrapfly') ? 'scrapfly' : 'scraperapi', url: target.toString(), premium, country: u.searchParams.get('country_code') || u.searchParams.get('country') })
      if (key !== 'test-unblock') {
        res.writeHead(401, { 'Content-Type': 'text/plain' })
        return res.end('Unauthorized')
      }
      const [st, html] = unblockedRoute(target.hostname, target.pathname, premium)
      if (req.url.startsWith('/scrapfly')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ result: { content: html, status_code: st } }))
      }
      res.writeHead(st, { 'Content-Type': 'text/html' })
      return res.end(html)
    } else if (req.url === '/hf/v1/chat/completions') {
      ;[status, payload] = hfChat(body, req.headers.authorization)
    }
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  })

  return Promise.all([
    new Promise((r) => store.listen(STORE_PORT, '0.0.0.0', r)),
    new Promise((r) => api.listen(API_PORT, '127.0.0.1', r)),
  ]).then(() => ({
    close: () => Promise.all([new Promise((r) => store.close(r)), new Promise((r) => api.close(r))]),
  }))
}
