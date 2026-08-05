/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'cheerio',
    'tesseract.js',
    'puppeteer',
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    '@sparticuz/chromium',
  ],
}

module.exports = nextConfig
