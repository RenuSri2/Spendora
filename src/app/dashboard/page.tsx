"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react" // ✅ Added useCallback
import DashboardLayout from "@/components/layout/DashboardLayout"
import SpendingInsights from "@/components/dashboard/SpendingInsights"
import { formatCurrency } from "@/lib/utils"
import {
  CreditCardIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline"

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
  budgetId?: string
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  categoryName?: string
}

interface Receipt {
  id: string
  [key: string]: any // For now, keeping flexible
}

interface DashboardStats {
  totalExpenses: number
  monthlyBudget: number
  budgetUsed: number
  totalReceipts: number
  recentExpenses: Expense[]
  activeBudgets: number
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    monthlyBudget: 0,
    budgetUsed: 0,
    totalReceipts: 0,
    recentExpenses: [],
    activeBudgets: 0,
  })
  const [allBudgets, setAllBudgets] = useState<Budget[]>([])
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([])
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ✅ FIXED: Wrap calculateStats in useCallback
  const calculateStats = useCallback((expenses: Expense[], budgets: Budget[], receipts: Receipt[], selectedBudgetIds: string[]) => {
    // If no budgets selected, show all budgets
    const filteredBudgets = selectedBudgetIds.length === 0 
      ? budgets 
      : budgets.filter(budget => selectedBudgetIds.includes(budget.id))
    
    // Filter expenses to only those linked to filtered budgets (if any budgets selected)
    const filteredExpenses = selectedBudgetIds.length === 0
      ? expenses
      : expenses.filter(expense => 
          expense.budgetId && selectedBudgetIds.includes(expense.budgetId)
        )
    
    // Calculate stats based on filtered data
    const totalExpenses = selectedBudgetIds.length === 0 
      ? expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
      : filteredExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
    const totalBudget = filteredBudgets.reduce((sum: number, budget: any) => sum + budget.amount, 0)
    const totalBudgetSpent = filteredBudgets.reduce((sum: number, budget: any) => sum + (budget.spent || 0), 0)
    const budgetUsed = totalBudget > 0 ? (totalBudgetSpent / totalBudget) * 100 : 0
    const recentExpenses = filteredExpenses.slice(0, 5)

    setStats({
      totalExpenses,
      monthlyBudget: totalBudget || (budgets.length > 0 ? budgets.reduce((sum: number, budget: any) => sum + budget.amount, 0) : 1000),
      budgetUsed,
      totalReceipts: receipts.length,
      recentExpenses,
      activeBudgets: filteredBudgets.length,
    })
    setIsLoading(false)
  }, []) // Empty deps since it only uses parameters

  // ✅ FIXED: Wrap fetchDashboardData in useCallback
  const fetchDashboardData = useCallback(async () => {
    try {
      // Recalculate budget spending first to ensure data consistency
      await fetch('/api/budgets/recalculate', { method: 'POST' })
      
      // Fetch expenses and budgets from API
      const [expensesRes, budgetsRes, receiptsRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/budgets'),
        fetch('/api/receipts')
      ])

      const expenses = expensesRes.ok ? await expensesRes.json() : []
      const budgets = budgetsRes.ok ? await budgetsRes.json() : []
      const receipts = receiptsRes.ok ? await receiptsRes.json() : []

      // Store raw data
      setAllExpenses(expenses)
      setAllBudgets(budgets)
      setAllReceipts(receipts)
      
      // Calculate stats for all budgets initially
      calculateStats(expenses, budgets, receipts, [])
      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      // Fallback to default data
      setStats({
        totalExpenses: 0,
        monthlyBudget: 1000,
        budgetUsed: 0,
        totalReceipts: 0,
        recentExpenses: [],
        activeBudgets: 0,
      })
      setIsLoading(false)
    }
  }, [calculateStats]) // ✅ Add calculateStats as dependency

  // ✅ FIXED: Add fetchDashboardData to dependencies
  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }
    
    // Fetch dashboard data
    fetchDashboardData()
  }, [status, router, fetchDashboardData]) // ✅ All dependencies included

  // Recalculate stats when budget selection changes
  useEffect(() => {
    if (allBudgets.length > 0 && allExpenses.length >= 0) {
      calculateStats(allExpenses, allBudgets, allReceipts, selectedBudgets)
    }
  }, [selectedBudgets, allBudgets, allExpenses, allReceipts, calculateStats]) // ✅ All deps

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
    </div>
  }

  if (status === "unauthenticated") {
    return null
  }

  const stats_cards = [
    {
      name: "Total Expenses",
      stat: `₹${stats.totalExpenses.toFixed(2)}`,
      icon: CreditCardIcon,
      change: "+12%",
      changeType: "increase",
    },
    {
      name: "Monthly Budget",
      stat: `₹${stats.monthlyBudget.toFixed(2)}`,
      icon: ChartBarIcon,
      change: `${stats.budgetUsed.toFixed(1)}% used`,
      changeType: stats.budgetUsed > 90 ? "decrease" : "increase",
    },
    {
      name: "Receipts Processed",
      stat: stats.totalReceipts.toString(),
      icon: DocumentTextIcon,
      change: "+3 this week",
      changeType: "increase",
    },
    {
      name: "Savings Goal",
      stat: "67%",
      icon: ArrowTrendingUpIcon,
      change: "+5% this month",
      changeType: "increase",
    },
  ]

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              {selectedBudgets.length > 0 
                ? `Viewing ${selectedBudgets.length} selected budget${selectedBudgets.length > 1 ? 's' : ''}: ${allBudgets.filter(b => selectedBudgets.includes(b.id)).map(b => b.name).join(', ')}`
                : 'Track your monthly spending and stay on budget.'
              }
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200"
              onClick={() => router.push('/dashboard/expenses')}
            >
              Add Transaction
            </button>
          </div>
        </div>

        {/* Budget Filter Section */}
        {allBudgets.length > 0 && (
          <div className="mt-6">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Filter by Budget</h3>
                {selectedBudgets.length > 0 && (
                  <button
                    onClick={() => setSelectedBudgets([])}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-200"
                  >
                    Clear Selection ({selectedBudgets.length})
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedBudgets.length === 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBudgets([])
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
                  />
                  <span className="ml-3 text-gray-300 font-medium">All Budgets</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allBudgets.map((budget) => {
                    const isSelected = selectedBudgets.includes(budget.id)
                    const remaining = budget.amount - (budget.spent || 0)
                    const percentage = budget.amount > 0 ? ((budget.spent || 0) / budget.amount) * 100 : 0
                    
                    return (
                      <label 
                        key={budget.id}
                        className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                          isSelected 
                            ? 'border-cyan-500 bg-cyan-500/10' 
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBudgets(prev => [...prev, budget.id])
                            } else {
                              setSelectedBudgets(prev => prev.filter(id => id !== budget.id))
                            }
                          }}
                          className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium truncate">{budget.name}</span>
                            <span className={`text-sm ${
                              percentage > 90 ? 'text-red-400' : 
                              percentage > 75 ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            ₹{budget.spent?.toFixed(0) || '0'} / ₹{budget.amount.toFixed(0)} 
                            {budget.categoryName && ` • ${budget.categoryName}`}
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                percentage > 90 ? 'bg-red-500' : 
                                percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two Tall, Thin Cards Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card - Budget Overview */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col h-[500px] relative overflow-hidden">
            {/* Decorative gradient overlay */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <ChartBarIcon className="w-6 h-6 text-cyan-400" />
                  {selectedBudgets.length > 0 ? 'Selected Budget' : 'Budget Overview'}
                </h2>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  stats.budgetUsed >= 90 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                  stats.budgetUsed >= 75 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                  'bg-green-500/20 text-green-400 border border-green-500/30'
                }`}>
                  {stats.budgetUsed >= 90 ? '⚠️ Critical' : stats.budgetUsed >= 75 ? '⚡ Warning' : '✓ Healthy'}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-8">
                  <div className="inline-flex items-baseline gap-2">
                    <span className="text-6xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                      {stats.budgetUsed.toFixed(0)}
                    </span>
                    <span className="text-3xl font-semibold text-cyan-400">%</span>
                  </div>
                  <p className="text-gray-400 mt-3 text-sm">
                    <span className="text-white font-medium">{formatCurrency(stats.totalExpenses)}</span> of{' '}
                    <span className="text-white font-medium">{formatCurrency(stats.monthlyBudget)}</span> spent
                  </p>
                </div>

                {/* Enhanced Progress Bar */}
                <div className="mb-8">
                  <div className="w-full bg-gray-700/50 rounded-full h-3 mb-3 relative overflow-hidden">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 relative ${
                        stats.budgetUsed >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                        stats.budgetUsed >= 75 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 
                        'bg-gradient-to-r from-green-500 to-cyan-500'
                      }`}
                      style={{ width: `${Math.min(stats.budgetUsed, 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Enhanced Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 p-4 rounded-xl border border-gray-600/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <div className="text-gray-400 text-xs font-medium">Spent</div>
                    </div>
                    <div className="text-xl font-bold text-white">{formatCurrency(stats.totalExpenses)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 p-4 rounded-xl border border-gray-600/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <div className="text-gray-400 text-xs font-medium">Remaining</div>
                    </div>
                    <div className="text-xl font-bold text-green-400">
                      {formatCurrency(Math.max(0, stats.monthlyBudget - stats.totalExpenses))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card - Spending Insights */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col h-[500px] relative overflow-hidden">
            {/* Decorative gradient overlay */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -ml-32 -mt-32"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <ArrowTrendingUpIcon className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Spending Insights</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                <SpendingInsights 
                  totalSpent={stats.totalExpenses}
                  monthlyBudget={stats.monthlyBudget}
                  budgetUsed={stats.budgetUsed}
                  topCategory={allExpenses[0]?.category || 'N/A'}
                  recentTransactions={stats.recentExpenses}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 shadow-lg hover:shadow-xl hover:border-gray-600 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                {selectedBudgets.length > 0 ? 'Budget Spent' : 'Budget Spent'}
              </div>
              <CreditCardIcon className="w-5 h-5 text-red-400/60 group-hover:text-red-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">₹{(stats.monthlyBudget * (stats.budgetUsed / 100)).toFixed(0)}</div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <span>From total budget</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 shadow-lg hover:shadow-xl hover:border-gray-600 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                {selectedBudgets.length > 0 ? 'Budget Left' : 'Remaining Budget'}
              </div>
              <ChartBarIcon className="w-5 h-5 text-green-400/60 group-hover:text-green-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-1">₹{(stats.monthlyBudget - (stats.monthlyBudget * (stats.budgetUsed / 100))).toFixed(0)}</div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
              <span>Available to spend</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 shadow-lg hover:shadow-xl hover:border-gray-600 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                {selectedBudgets.length > 0 ? 'Total Expenses' : 'Total Expenses'}
              </div>
              <DocumentTextIcon className="w-5 h-5 text-blue-400/60 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-blue-400 mb-1">₹{stats.totalExpenses.toFixed(0)}</div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
              <span>{stats.recentExpenses.length} transactions</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 shadow-lg hover:shadow-xl hover:border-gray-600 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                {selectedBudgets.length > 0 ? 'Selected Budgets' : 'Active Budgets'}
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-purple-400/60 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.activeBudgets}</div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Currently tracking</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button 
            onClick={() => router.push('/dashboard/expenses')}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Add Transaction
          </button>
          <button 
            onClick={() => router.push('/dashboard/receipts')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            View Reports
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8">
          <div className="sm:flex sm:items-center mb-6">
            <div className="sm:flex-auto">
              <h2 className="text-xl font-semibold text-white">Recent Transactions</h2>
              <p className="mt-2 text-sm text-gray-400">
                Your latest spending activity
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200"
                onClick={() => router.push('/dashboard/expenses')}
              >
                View all
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center">
                        <div className="animate-pulse text-gray-400">Loading...</div>
                      </td>
                    </tr>
                  ) : stats.recentExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No recent expenses. Add your first expense to get started!
                      </td>
                    </tr>
                  ) : (
                    stats.recentExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-750 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {expense.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-900 text-cyan-300">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                          ₹{expense.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {new Date(expense.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
