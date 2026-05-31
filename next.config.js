/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    'cheerio', 'jsdom', 'puppeteer', 'puppeteer-extra',
    'puppeteer-extra-plugin-stealth', 'playwright', 'tesseract.js', 'canvas',
  ],
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
