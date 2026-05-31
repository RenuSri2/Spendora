import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { addExpenseFromReceipt } from '@/lib/visionReceiptReader'
import { VisionReceiptResult } from '@/lib/visionReceiptReader'

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  formattedPrice?: string
}

interface ReceiptData {
  storeName: string
  total: number
  items: ReceiptItem[]
  date: string
  formattedTotal: string
  confidence?: number
}

interface ExpenseFromReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  receipt: ReceiptData
  onSuccess: () => void
}

export default function ExpenseFromReceiptModal({
  isOpen,
  onClose,
  receipt,
  onSuccess,
}: ExpenseFromReceiptModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    budgetId: '',
    category: '',
    description: receipt.storeName || 'Receipt Purchase',
  })

  const budgetOptions = [
    { id: 'groceries', name: 'Groceries' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'food', name: 'Food & Dining' },
    { id: 'transportation', name: 'Transportation' },
    { id: 'bills', name: 'Bills & Utilities' },
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'other', name: 'Other' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.budgetId || !formData.category) {
      setError('Please select both budget and category')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Create a VisionReceiptResult compatible object
      const receiptData: VisionReceiptResult = {
        storeName: receipt.storeName,
        total: receipt.total,
        formattedTotal: receipt.formattedTotal,
        date: receipt.date,
        items: receipt.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          formattedPrice: item.formattedPrice || `₹${item.totalPrice.toFixed(2)}`
        })),
        confidence: receipt.confidence || 90 // Default confidence if not provided
      }

      await addExpenseFromReceipt(
        receiptData,
        formData.budgetId,
        formData.category,
        formData.description
      )
      onSuccess()
      onClose()
    } catch (err) {
      setError('Failed to add expense. Please try again.')
      console.error('Error adding expense:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Add Expense from Receipt
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    Store: <span className="font-medium">{receipt.storeName}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Total: <span className="font-medium">₹{receipt.total.toFixed(2)}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Date: <span className="font-medium">{receipt.date}</span>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="budgetId" className="block text-sm font-medium text-gray-700">
                      Budget
                    </label>
                    <select
                      id="budgetId"
                      value={formData.budgetId}
                      onChange={(e) => setFormData({ ...formData, budgetId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a budget</option>
                      {budgetOptions.map((budget) => (
                        <option key={budget.id} value={budget.id}>
                          {budget.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a category</option>
                      {budgetOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Adding...' : 'Add Expense'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
