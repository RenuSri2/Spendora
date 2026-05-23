import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Get user-specific file paths
const getUserFiles = (userId: string) => {
  const userDir = path.join(DATA_DIR, userId)
  
  // Ensure user directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true })
  }
  
  return {
    expenses: path.join(userDir, 'expenses.json'),
    budgets: path.join(userDir, 'budgets.json'),
    receipts: path.join(userDir, 'receipts.json')
  }
}

// Initialize empty files if they don't exist
const initializeFile = (filePath: string, defaultData: any) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2))
  }
}

// Generic database operations
export const readData = <T>(filePath: string): T[] => {
  initializeFile(filePath, [])
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
    return []
  }
}

export const writeData = <T>(filePath: string, data: T[]): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
  }
}

// Expense operations
export const getExpenses = (userId: string) => {
  const files = getUserFiles(userId)
  return readData(files.expenses)
}

export const saveExpenses = (userId: string, expenses: any[]) => {
  const files = getUserFiles(userId)
  writeData(files.expenses, expenses)
}

export const addExpense = (userId: string, expense: any) => {
  const expenses = getExpenses(userId)
  expenses.unshift(expense)
  saveExpenses(userId, expenses)
  
  // Update budget spent amount if expense is linked to a budget
  if (expense.budgetId) {
    const budgets = getBudgets(userId)
    const budgetIndex = budgets.findIndex((b: any) => b.id === expense.budgetId)
    if (budgetIndex !== -1) {
      budgets[budgetIndex].spent = (budgets[budgetIndex].spent || 0) + expense.amount
      saveBudgets(userId, budgets)
    }
  }
  
  return expense
}

export const deleteExpense = (userId: string, expenseId: string) => {
  const expenses = getExpenses(userId)
  const expenseIndex = expenses.findIndex((e: any) => e.id === expenseId)
  
  if (expenseIndex === -1) {
    throw new Error('Expense not found')
  }
  
  const deletedExpense = expenses[expenseIndex]
  expenses.splice(expenseIndex, 1)
  saveExpenses(userId, expenses)
  
  // Update budget spent amount if expense was linked to a budget
  if (deletedExpense.budgetId) {
    const budgets = getBudgets(userId)
    const budgetIndex = budgets.findIndex((b: any) => b.id === deletedExpense.budgetId)
    if (budgetIndex !== -1) {
      budgets[budgetIndex].spent = Math.max(0, (budgets[budgetIndex].spent || 0) - deletedExpense.amount)
      saveBudgets(userId, budgets)
    }
  }
  
  return deletedExpense
}

// Budget operations
export const getBudgets = (userId: string) => {
  const files = getUserFiles(userId)
  return readData(files.budgets)
}

export const saveBudgets = (userId: string, budgets: any[]) => {
  const files = getUserFiles(userId)
  writeData(files.budgets, budgets)
}

export const addBudget = (userId: string, budget: any) => {
  const budgets = getBudgets(userId)
  budgets.unshift(budget)
  saveBudgets(userId, budgets)
  return budget
}

export const deleteBudget = (userId: string, budgetId: string) => {
  const budgets = getBudgets(userId)
  const budgetIndex = budgets.findIndex((b: any) => b.id === budgetId)
  
  if (budgetIndex === -1) {
    throw new Error('Budget not found')
  }
  
  const deletedBudget = budgets[budgetIndex]
  budgets.splice(budgetIndex, 1)
  saveBudgets(userId, budgets)
  
  // Remove budget linkage from expenses
  const expenses = getExpenses(userId)
  const updatedExpenses = expenses.map((expense: any) => {
    if (expense.budgetId === budgetId) {
      const { budgetId, budgetName, ...expenseWithoutBudget } = expense
      return expenseWithoutBudget
    }
    return expense
  })
  saveExpenses(userId, updatedExpenses)
  
  return deletedBudget
}

// Receipt operations
export const getReceipts = (userId: string) => {
  const files = getUserFiles(userId)
  return readData(files.receipts)
}

export const saveReceipts = (userId: string, receipts: any[]) => {
  const files = getUserFiles(userId)
  writeData(files.receipts, receipts)
}

export const addReceipt = (userId: string, receipt: any) => {
  const receipts = getReceipts(userId)
  receipts.unshift(receipt)
  saveReceipts(userId, receipts)
  return receipt
}

export const updateReceipt = (userId: string, receiptId: string, updates: any) => {
  const receipts = getReceipts(userId)
  const index = receipts.findIndex((r: any) => r.id === receiptId)
  if (index !== -1) {
    receipts[index] = { ...receipts[index], ...updates }
    saveReceipts(userId, receipts)
  }
  return receipts[index]
}

// Recalculate budget spending based on expenses
export const recalculateBudgetSpending = (userId: string) => {
  const expenses = getExpenses(userId)
  const budgets = getBudgets(userId)
  
  // Reset all budget spending
  budgets.forEach((budget: any) => {
    budget.spent = 0
  })
  
  // Calculate spending for each budget based on linked expenses
  expenses.forEach((expense: any) => {
    if (expense.budgetId) {
      const budgetIndex = budgets.findIndex((b: any) => b.id === expense.budgetId)
      if (budgetIndex !== -1) {
        budgets[budgetIndex].spent = (budgets[budgetIndex].spent || 0) + expense.amount
      }
    }
  })
  
  saveBudgets(userId, budgets)
  return budgets
}
