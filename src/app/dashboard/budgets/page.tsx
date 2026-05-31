"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PlusIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  period: 'weekly' | 'monthly' | 'yearly'
  startDate: string
  endDate: string
  categoryId?: string
  categoryName?: string
  isActive: boolean
}

interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export default function BudgetsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    period: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    categoryId: '',
  })

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    loadData()
  }, [status, router])

  const loadData = async () => {
    try {
      // Set categories (these could also come from API in the future)
      setCategories([
        { id: '1', name: 'Food & Dining', color: '#10B981', icon: '🍽️' },
        { id: '2', name: 'Transportation', color: '#3B82F6', icon: '🚗' },
        { id: '3', name: 'Shopping', color: '#8B5CF6', icon: '🛍️' },
        { id: '4', name: 'Entertainment', color: '#F59E0B', icon: '🎬' },
        { id: '5', name: 'Bills & Utilities', color: '#EF4444', icon: '💡' },
        { id: '6', name: 'Healthcare', color: '#06B6D4', icon: '🏥' },
      ])
      
      // Recalculate budget spending first to ensure data consistency
      await fetch('/api/budgets/recalculate', { method: 'POST' })
      
      // Fetch budgets from API
      const response = await fetch('/api/budgets')
      if (response.ok) {
        const budgetsData = await response.json()
        setBudgets(budgetsData)
      } else {
        console.error('Failed to fetch budgets:', response.statusText)
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.amount || !formData.period) {
      alert('Please fill in all required fields')
      return
    }

    const category = categories.find(c => c.id === formData.categoryId)
    const today = new Date()
    let endDate = new Date(today)

    // Calculate end date based on period
    switch (formData.period) {
      case 'weekly':
        endDate.setDate(today.getDate() + 7)
        break
      case 'monthly':
        endDate.setMonth(today.getMonth() + 1)
        break
      case 'yearly':
        endDate.setFullYear(today.getFullYear() + 1)
        break
    }
    
    const budgetData = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      spent: 0,
      period: formData.period,
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      categoryId: formData.categoryId || undefined,
      categoryName: category?.name,
      isActive: true,
    }

    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(budgetData),
      })

      if (response.ok) {
        const newBudget = await response.json()
        setBudgets(prev => [newBudget, ...prev])
        setFormData({
          name: '',
          amount: '',
          period: 'monthly',
          categoryId: '',
        })
        setShowAddForm(false)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to create budget'}`)
      }
    } catch (error) {
      console.error('Error creating budget:', error)
      alert('Failed to create budget. Please try again.')
    }
  }

  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!confirm(`Are you sure you want to delete the budget "${budgetName}"? This will also unlink all associated expenses.`)) {
      return
    }

    setDeletingBudgetId(budgetId)
    try {
      const response = await fetch(`/api/budgets?id=${budgetId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setBudgets(prev => prev.filter(budget => budget.id !== budgetId))
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete budget'}`)
      }
    } catch (error) {
      console.error('Error deleting budget:', error)
      alert('Failed to delete budget. Please try again.')
    } finally {
      setDeletingBudgetId(null)
    }
  }

  const getBudgetStatus = (budget: Budget) => {
    const percentage = (budget.spent / budget.amount) * 100
    if (percentage >= 100) return { status: 'exceeded', color: 'text-red-600', bgColor: 'bg-red-100', icon: ExclamationTriangleIcon }
    if (percentage >= 90) return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: ExclamationTriangleIcon }
    if (percentage >= 75) return { status: 'caution', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: ExclamationTriangleIcon }
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircleIcon }
  }

  const getDaysRemaining = (endDate: string) => {
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
  const totalRemaining = totalBudget - totalSpent

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
    </div>
  }

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Budget Tracker</h1>
            <p className="mt-2 text-sm text-gray-400">
              Set budgets, track spending, and stay on financial track
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200 sm:w-auto"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Budget
            </button>
          </div>
        </div>

        {/* Add Budget Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-gray-600 w-96 shadow-2xl rounded-2xl bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-white mb-4">Create New Budget</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Budget Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                      placeholder="e.g., Monthly Food Budget"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Budget Amount</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 sm:text-sm">₹</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="block w-full pl-7 rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Period</label>
                    <select
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value as 'weekly' | 'monthly' | 'yearly' })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Category (Optional)</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800"
                    >
                      Create Budget
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Budget Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">₹</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Total Budget</dt>
                    <dd className="text-lg font-medium text-white">₹{totalBudget.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">-</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Total Spent</dt>
                    <dd className="text-lg font-medium text-white">₹{totalSpent.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">+</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">Remaining</dt>
                    <dd className={`text-lg font-medium ${totalRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ₹{totalRemaining.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Cards */}
        <div className="mt-8">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-pulse">Loading budgets...</div>
            </div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-white">No budgets</h3>
              <p className="mt-1 text-sm text-gray-400">Get started by creating your first budget.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((budget) => {
                const percentage = (budget.spent / budget.amount) * 100
                const status = getBudgetStatus(budget)
                const daysRemaining = getDaysRemaining(budget.endDate)
                const category = categories.find(c => c.id === budget.categoryId)
                
                return (
                  <div key={budget.id} className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white truncate">{budget.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                            <status.icon className="w-3 h-3 mr-1" />
                            {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                          </span>
                          <button
                            onClick={() => handleDeleteBudget(budget.id, budget.name)}
                            disabled={deletingBudgetId === budget.id}
                            className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed transition-colors duration-200 p-1"
                            title="Delete budget"
                          >
                            {deletingBudgetId === budget.id ? (
                              <div className="animate-spin h-4 w-4 border border-red-400 rounded-full border-t-transparent" />
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {budget.categoryName && (
                        <div className="mb-3">
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: category?.color || '#6B7280' }}
                          >
                            {category?.icon} {budget.categoryName}
                          </span>
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-400 mb-1">
                          <span>₹{budget.spent.toFixed(2)} spent</span>
                          <span>₹{budget.amount.toFixed(2)} budget</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              percentage >= 100 ? 'bg-red-500' :
                              percentage >= 90 ? 'bg-yellow-500' :
                              percentage >= 75 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>{percentage.toFixed(1)}% used</span>
                          <span>₹{(budget.amount - budget.spent).toFixed(2)} left</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400">
                        <span className="capitalize">{budget.period}</span>
                        <span>{daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
