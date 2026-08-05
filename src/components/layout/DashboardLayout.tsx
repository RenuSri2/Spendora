"use client"

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'AI Assistant', href: '/ai-assistant', icon: SparklesIcon },
  { name: 'Transactions', href: '/dashboard/expenses', icon: CreditCardIcon },
  { name: 'Budgets', href: '/dashboard/budgets', icon: ChartBarIcon },
  { name: 'Reports', href: '/dashboard/receipts', icon: DocumentTextIcon },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Top nav bar */}
      <header className="sticky top-0 z-40 border-b border-gray-700 bg-gray-800/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <div className="h-8 w-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="ml-2 text-xl font-semibold text-white">Spendora</span>
            </div>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      isActive
                        ? 'bg-gray-700 text-cyan-400'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    } flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors`}
                  >
                    <item.icon className={`${isActive ? 'text-cyan-400' : 'text-gray-400'} h-5 w-5`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* User + sign out (desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {session?.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="h-8 w-8 rounded-full"
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                />
              )}
              <span className="text-sm text-gray-300">{session?.user?.name}</span>
              <button
                onClick={handleSignOut}
                className="text-xs font-medium text-gray-400 hover:text-gray-200 border border-gray-700 rounded-md px-2 py-1"
              >
                Sign out
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-700 bg-gray-800 px-2 py-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${
                    isActive
                      ? 'bg-gray-700 text-cyan-400'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } flex items-center gap-3 px-3 py-2 text-base font-medium rounded-md`}
                >
                  <item.icon className={`${isActive ? 'text-cyan-400' : 'text-gray-400'} h-6 w-6`} />
                  {item.name}
                </Link>
              )
            })}
            <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-3 px-3">
              <span className="text-sm text-gray-300">{session?.user?.name}</span>
              <button
                onClick={handleSignOut}
                className="text-xs font-medium text-gray-400 hover:text-gray-200 border border-gray-700 rounded-md px-2 py-1"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
