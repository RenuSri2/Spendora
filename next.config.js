/** @type {import('next').NextConfig} */
const nextConfig = {
  // Loaded only at runtime on the server; keep them out of the bundle.
  // puppeteer-core is used purely as a CDP client for Lightpanda — it never
  // downloads or launches Chrome.
  serverExternalPackages: ['cheerio', 'tesseract.js', 'puppeteer-core'],
}

module.exports = nextConfig
