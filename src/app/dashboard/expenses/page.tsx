"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
  userId: string
  budgetId?: string
  budgetName?: string
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  categoryName?: string
}

interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export default function ExpensesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    categoryId: '',
    budgetId: '',
    date: new Date().toISOString().split('T')[0],
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
      
      // Fetch expenses and budgets from API
      const [expensesRes, budgetsRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/budgets')
      ])
      
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json()
        setExpenses(expensesData)
      } else {
        console.error('Failed to fetch expenses:', expensesRes.statusText)
      }
      
      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json()
        setBudgets(budgetsData)
      } else {
        console.error('Failed to fetch budgets:', budgetsRes.statusText)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.description || !formData.amount || !formData.categoryId) {
      alert('Please fill in all required fields')
      return
    }

    const categoryName = categories.find(c => c.id === formData.categoryId)?.name || 'Other'
    const selectedBudget = budgets.find(b => b.id === formData.budgetId)
    
    const expenseData = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: categoryName,
      date: formData.date,
      userId: session?.user?.id || '',
      budgetId: formData.budgetId || undefined,
      budgetName: selectedBudget?.name,
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      })

      if (response.ok) {
        const newExpense = await response.json()
        setExpenses(prev => [newExpense, ...prev])
        
        // Refresh budgets to show updated spending
        const budgetsRes = await fetch('/api/budgets')
        if (budgetsRes.ok) {
          const budgetsData = await budgetsRes.json()
          setBudgets(budgetsData)
        }
        
        setFormData({
          description: '',
          amount: '',
          categoryId: '',
          budgetId: '',
          date: new Date().toISOString().split('T')[0],
        })
        setShowAddForm(false)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to create expense'}`)
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      alert('Failed to create expense. Please try again.')
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return
    }

    setDeletingExpenseId(expenseId)
    try {
      const response = await fetch(`/api/expenses?id=${expenseId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
        
        // Refresh budgets to show updated spending
        const budgetsRes = await fetch('/api/budgets')
        if (budgetsRes.ok) {
          const budgetsData = await budgetsRes.json()
          setBudgets(budgetsData)
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete expense'}`)
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Failed to delete expense. Please try again.')
    } finally {
      setDeletingExpenseId(null)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || expense.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

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
            <h1 className="text-2xl font-semibold text-white">Expenses</h1>
            <p className="mt-2 text-sm text-gray-400">
              Track and manage your daily expenses
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200 sm:w-auto"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Expense
            </button>
          </div>
        </div>

        {/* Add Expense Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-gray-600 w-96 shadow-2xl rounded-2xl bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-white mb-4">Add New Expense</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                      placeholder="Enter expense description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Amount</label>
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
                    <label className="block text-sm font-medium text-gray-300">Category</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Budget (Optional)</label>
                    <select
                      value={formData.budgetId}
                      onChange={(e) => setFormData({ ...formData, budgetId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">No budget (general expense)</option>
                      {budgets.map((budget) => {
                        const remaining = budget.amount - budget.spent
                        const isOverBudget = remaining < 0
                        return (
                          <option 
                            key={budget.id} 
                            value={budget.id}
                            disabled={isOverBudget}
                          >
                            {budget.name} - ₹{remaining.toFixed(2)} remaining
                            {budget.categoryName ? ` (${budget.categoryName})` : ''}
                            {isOverBudget ? ' (Over budget)' : ''}
                          </option>
                        )
                      })}
                    </select>
                    {formData.budgetId && (() => {
                      const selectedBudget = budgets.find(b => b.id === formData.budgetId)
                      if (selectedBudget) {
                        const remaining = selectedBudget.amount - selectedBudget.spent
                        const expenseAmount = parseFloat(formData.amount) || 0
                        const newRemaining = remaining - expenseAmount
                        return (
                          <p className={`mt-1 text-xs ${
                            newRemaining < 0 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            After this expense: ₹{newRemaining.toFixed(2)} remaining
                            {newRemaining < 0 && ' (over budget)'}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800"
                    >
                      Add Expense
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

        {/* Filters and Search */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
              placeholder="Search expenses..."
            />
          </div>
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-6">
          <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-cyan-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">₹</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-400 truncate">
                      Total {selectedCategory !== 'all' ? selectedCategory : ''} Expenses
                    </dt>
                    <dd className="text-lg font-medium text-white">
                      ₹{totalExpenses.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="mt-6">
          <div className="flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Budget
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center">
                            <div className="animate-pulse text-gray-400">Loading expenses...</div>
                          </td>
                        </tr>
                      ) : filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                            {searchTerm || selectedCategory !== 'all' 
                              ? 'No expenses match your filters.' 
                              : 'No expenses yet. Add your first expense to get started!'
                            }
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((expense) => {
                          const category = categories.find(c => c.name === expense.category)
                          return (
                            <tr key={expense.id} className="hover:bg-gray-750 transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                {expense.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                <span 
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: category?.color || '#6B7280' }}
                                >
                                  {category?.icon} {expense.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                                ₹{expense.amount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {expense.budgetName ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-300">
                                    {expense.budgetName}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">No budget</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {new Date(expense.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  disabled={deletingExpenseId === expense.id}
                                  className="text-red-400 hover:text-red-300 disabled:text-red-600 disabled:cursor-not-allowed transition-colors duration-200"
                                  title="Delete expense"
                                >
                                  {deletingExpenseId === expense.id ? (
                                    <div className="animate-spin h-4 w-4 border border-red-400 rounded-full border-t-transparent" />
                                  ) : (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
