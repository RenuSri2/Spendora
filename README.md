<div align="center">

# 💸 Spendora

### Your AI-Powered Personal Finance Companion

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Spendora** is a full-stack expense tracking and financial intelligence platform built with Next.js. It combines smart budget management, AI-powered receipt scanning, real-time product price scraping, and a Mamdani Fuzzy Logic engine to give you genuinely intelligent financial insights — all wrapped in a sleek dark-mode UI.

[Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Project Structure](#-project-structure) • [Screenshots](#-screenshots) • [Roadmap](#-roadmap)

</div>

---

## ✨ Features

### 🏦 Budget & Expense Management
- Create and manage **budgets** by period (weekly / monthly / yearly) and category
- Track **expenses** with categories, descriptions, and dates
- Real-time **budget utilization** with color-coded health indicators (✓ Healthy / ⚡ Warning / ⚠️ Critical)
- Multi-budget filtering on the dashboard to drill into individual spending areas
- Automatic budget recalculation to keep totals always in sync

### 📊 Financial Insights Dashboard
- **Spending trends** over time with interactive Recharts visualizations
- **Category breakdown** — see exactly where your money goes
- **Monthly trends** chart for long-range spending patterns
- **Saving opportunities** — automatically surfaced based on your data
- AI-generated insight summaries via the `/api/insights` endpoint suite

### 🤖 AI Assistant
- Dedicated `/ai-assistant` page powered by the Anthropic API
- **Deep analysis** mode at `/ai-assistant/analysis` for in-depth financial breakdowns
- Contextual advice based on your actual budget and expense data
- Flash AI integration for lightning-fast responses

### 📷 Receipt Scanner
- Upload receipts (images or PDFs) and let Tesseract.js **extract text via OCR**
- AI-powered receipt analysis to auto-populate vendor, total amount, and date
- Convert scanned receipts directly into expenses with one click
- Full receipt history stored and linked to expenses

### 🦉 Money Mascot (Mamdani Fuzzy Logic)
- An animated **owl mascot** that gives smart, context-aware financial tips
- Powered by a **Mamdani Fuzzy Inference System** (`src/lib/mamdaniFuzzySystem.ts`)
- Input variables: `budgetUtilization`, `spendingTrend`, `savingsRate`
- Output: `tipPriority` + `mascotMood` (Happy / Concerned / Celebrating)
- Eye-tracking, animated states (Idle, Talking, Excited, Alert), and auto-tips every 2 minutes
- Click the owl anytime for an instant personalized financial nudge

### 🛒 Product Price Tracker
- Scrape **real-time product prices** from e-commerce platforms using Puppeteer + Cheerio
- Stealth scraping via `puppeteer-extra-plugin-stealth` to avoid bot detection
- **Price history charts** (`PriceHistoryChart.tsx`) to track fluctuations over time
- Proxy scraper route (`/api/proxy-scraper`) for resilient data collection
- `Product` model in Prisma to persist prices and compare across platforms

### 🔐 Authentication
- Secure auth with **NextAuth.js** + Prisma adapter
- Session-based protection on all dashboard and API routes
- Credential provider with `bcryptjs` password hashing

### 💱 Currency Support
- Built-in currency converter (`src/lib/currencyConverter.ts`) for multi-currency expense logging

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router + Turbopack) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4, Framer Motion, Radix UI, Headless UI |
| **Icons** | Heroicons, Lucide React |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod |
| **Database** | SQLite (via Prisma ORM) |
| **Auth** | NextAuth.js v4 + Prisma Adapter |
| **OCR** | Tesseract.js |
| **Scraping** | Puppeteer, Puppeteer Extra (Stealth), Playwright, Cheerio |
| **AI** | Anthropic API (Claude), Flash AI Integration |
| **Fuzzy Logic** | Custom Mamdani Fuzzy System |
| **Utilities** | date-fns, lodash.debounce, uuid, axios |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** (or yarn / pnpm / bun)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/spendora.git
cd spendora
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.local .env
```

Open `.env` and set:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Anthropic AI (for AI Assistant features)
ANTHROPIC_API_KEY=your-anthropic-api-key

# (Optional) Other API keys as needed
```

### 4. Set up the database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. 🎉

---

## 📁 Project Structure

```
spendora/
├── prisma/
│   └── schema.prisma          # Database schema (User, Expense, Budget, Goal, Receipt, Product)
├── public/
│   └── data/                  # Default seed data (budgets, expenses, receipts)
├── src/
│   ├── app/
│   │   ├── ai-assistant/      # AI chat + deep analysis pages
│   │   ├── api/               # API routes
│   │   │   ├── ai-analysis/   # AI financial analysis endpoint
│   │   │   ├── insights/      # Insights: summary, trends, categories, opportunities
│   │   │   ├── proxy-scraper/ # Product price scraper proxy
│   │   │   └── receipts/      # Receipt upload & analysis
│   │   ├── auth/signin/       # Sign-in page
│   │   ├── dashboard/
│   │   │   ├── budgets/       # Budget management
│   │   │   ├── expenses/      # Expense tracking
│   │   │   └── receipts/      # Receipt gallery
│   │   └── insights/          # Financial insights page
│   ├── components/
│   │   ├── dashboard/         # SpendingInsights, MiniInsights
│   │   ├── insights/          # InsightsDashboard, SavingOpportunities, charts
│   │   ├── layout/            # DashboardLayout, sidebar nav
│   │   ├── receipts/          # ExpenseFromReceiptModal
│   │   ├── ui/                # Shared UI: Button, Card, Alert, Tabs, Skeleton
│   │   ├── MoneyMascot.tsx    # 🦉 Animated fuzzy-logic mascot
│   │   ├── MascotWrapper.tsx  # Client-side mascot mounting
│   │   └── PriceHistoryChart.tsx
│   ├── lib/
│   │   ├── mamdaniFuzzySystem.ts    # Fuzzy inference engine
│   │   ├── visionReceiptReader.ts   # OCR + AI receipt parser
│   │   ├── productScrapingService.ts
│   │   ├── puppeteerScraper.ts
│   │   ├── realMarketDataAPI.ts
│   │   ├── currencyConverter.ts
│   │   ├── flashAIIntegration.ts
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── prisma.ts                # Prisma client singleton
│   │   └── utils.ts
│   └── pages/api/             # Pages Router API routes (budgets, expenses, receipts)
```

---

## 🗄 Database Schema

Spendora uses **Prisma with SQLite** (easily swappable to PostgreSQL / MongoDB).

| Model | Description |
|---|---|
| `User` | Auth user with profile and timestamps |
| `Category` | Custom spending categories with colors & icons |
| `Expense` | Individual transactions linked to category, budget, and optional receipt |
| `Budget` | Spending limits by period with live `spent` tracking |
| `Goal` | Savings goals with target amounts and deadlines |
| `Receipt` | Uploaded receipt files with OCR text and extracted metadata |
| `Product` | Scraped product listings with price history across platforms |

---

## 🧠 Mamdani Fuzzy Logic System

Spendora's mascot tips are driven by a custom **Mamdani Fuzzy Inference System**, not simple if/else rules.

**Input variables:**

| Variable | Range | Membership Sets |
|---|---|---|
| `budgetUtilization` | 0–100% | LOW, MEDIUM, HIGH, CRITICAL |
| `spendingTrend` | -100 to +100 | DOWN, STABLE, UP |
| `savingsRate` | 0–100% | LOW, HEALTHY, EXCELLENT |

**Output variables:**

| Variable | Range | Membership Sets |
|---|---|---|
| `tipPriority` | 0–100 | LOW, MEDIUM, HIGH, CRITICAL |
| `mascotMood` | 0–100 | HAPPY, CONCERNED, CELEBRATING |

Example rules:
- `IF budgetUtilization IS CRITICAL → tipPriority IS CRITICAL, mascotMood IS CONCERNED`
- `IF savingsRate IS EXCELLENT → tipPriority IS LOW, mascotMood IS CELEBRATING`

---

## 📜 Available Scripts

```bash
npm run dev      # Start development server with Turbopack
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npx prisma studio  # Open Prisma Studio (visual DB browser)
```

---

## 🌐 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/expenses` | GET / POST | List or create expenses |
| `/api/budgets` | GET / POST | List or create budgets |
| `/api/budgets/recalculate` | POST | Recalculate budget `spent` totals |
| `/api/receipts` | GET / POST | List or upload receipts |
| `/api/receipts/analyze` | POST | OCR + AI analysis of a receipt |
| `/api/ai-analysis` | POST | AI financial deep-analysis |
| `/api/insights` | GET | Aggregated financial insights |
| `/api/insights/summary` | GET | Spending summary |
| `/api/insights/trends` | GET | Spending trends over time |
| `/api/insights/categories` | GET | Per-category breakdown |
| `/api/insights/opportunities` | GET | Saving opportunities |
| `/api/proxy-scraper` | GET | Product price scraping proxy |

---

## 🚢 Deployment

### Deploy on Vercel (recommended)

1. Push your repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add all environment variables from your `.env` file in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js and handles everything

> **Note:** For production, swap SQLite for **PostgreSQL** by updating `datasource db` in `prisma/schema.prisma` and setting a `DATABASE_URL` pointing to your Postgres instance.

### Deploy on a VPS / Docker

```bash
npm run build
npm run start
```

---

## 🗺 Roadmap

- [ ] PostgreSQL / PlanetScale production database support
- [ ] Mobile app (React Native / Expo)
- [ ] Multi-currency dashboard with live exchange rates
- [ ] Recurring expense detection & reminders
- [ ] Export to CSV / PDF reports
- [ ] Email / push notifications for budget alerts
- [ ] OAuth providers (Google, GitHub)
- [ ] Shared household budgets (multi-user)

---

## 🤝 Contributing

Contributions are very welcome! Here's how:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please make sure `npm run lint` passes before submitting.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- [Next.js](https://nextjs.org/) — the backbone of this app
- [Prisma](https://www.prisma.io/) — effortless database access
- [NextAuth.js](https://next-auth.js.org/) — auth made simple
- [Recharts](https://recharts.org/) — beautiful React charts
- [Tesseract.js](https://tesseract.projectnaptha.com/) — in-browser OCR
- [Framer Motion](https://www.framer.com/motion/) — smooth animations
- [Anthropic Claude](https://www.anthropic.com/) — AI intelligence

---

<div align="center">

Made with ❤️ and fuzzy logic

⭐ **Star this repo** if you found it useful!

</div>
