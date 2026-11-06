import type { Metadata } from "next"
// Self-hosted via the `geist` package — no Google Fonts fetch at build time
// (that fetch fails on locked-down CI and occasionally on Vercel).
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { SessionProvider } from "@/components/providers/SessionProvider"
import MascotWrapper from "@/components/MascotWrapper"

export const metadata: Metadata = {
  title: "Spendora - Smart Personal Finance Manager",
  description: "Track expenses, manage budgets, compare prices, and achieve your financial goals",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <SessionProvider>
          {children}
          <MascotWrapper />
        </SessionProvider>
      </body>
    </html>
  )
}
