"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CameraIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { visionReceiptReader } from "@/lib/visionReceiptReader";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  formattedUnitPrice?: string;
  formattedTotalPrice?: string;
}

interface Receipt {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  extractedText?: string;
  vendor?: string;
  totalAmount?: number;
  date?: string;
  processed: boolean;
  createdAt: string;
  items?: ReceiptItem[];
  storeName?: string;
  storeAddress?: string;
  receiptNumber?: string;
  paymentMethod?: string;
  formattedTotal?: string;
  ocrConfidence?: number;
  processingTime?: number;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: string;
  categoryName: string;
}

export default function ReceiptsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    categoryId: "",
    budgetId: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    loadReceipts();
  }, [status, router]);

  const loadReceipts = async () => {
    try {
      // Mock data for demonstration
      // Start with empty receipts - user will upload their own
      setTimeout(() => {
        setReceipts([]);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error loading receipts:", error);
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      await handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        alert("Please upload only image files (JPEG, PNG) or PDF files.");
        continue;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB.");
        continue;
      }

      // Create mock receipt entry
      const newReceipt: Receipt = {
        id: Date.now().toString() + i,
        fileName: file.name,
        filePath: `/uploads/receipts/${file.name}`,
        fileType: file.type,
        processed: false,
        createdAt: new Date().toISOString(),
      };

      // Add to receipts list
      setReceipts((prev) => [newReceipt, ...prev]);

      // Simulate OCR processing
      setTimeout(() => {
        processReceiptOCR(newReceipt.id, file);
      }, 2000);
    }

    setIsUploading(false);
  };

  const handleExpenseAdded = async () => {
    // Refresh the receipts list
    await loadReceipts();
    setShowAddForm(false);
    setSelectedReceipt(null);
  };

  const handleCreateExpense = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setFormData((prev) => ({
      ...prev,
      description: receipt.storeName || "Receipt Purchase",
      amount: receipt.totalAmount?.toString() || "0",
      date: receipt.date || new Date().toISOString().split("T")[0],
    }));
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.description || !formData.amount || !formData.categoryId) {
      alert("Please fill in all required fields");
      return;
    }

    const categoryName =
      categories.find((c) => c.id === formData.categoryId)?.name || "Other";
    const selectedBudget = budgets.find((b) => b.id === formData.budgetId);

    const expenseData = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: categoryName,
      date: formData.date,
      userId: session?.user?.id || "",
      budgetId: formData.budgetId || undefined,
      budgetName: selectedBudget?.name,
    };

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
      });

      if (response.ok) {
        await handleExpenseAdded();
        // Reset form
        setFormData({
          description: "",
          amount: "",
          categoryId: "",
          budgetId: "",
          date: new Date().toISOString().split("T")[0],
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || "Failed to create expense"}`);
      }
    } catch (error) {
      console.error("Error creating expense:", error);
      alert("Failed to create expense. Please try again.");
    }
  };

  // Mock categories and budgets - replace with your actual data
  const categories = [
    { id: "1", name: "Food & Dining", color: "#10B981", icon: "🍽️" },
    { id: "2", name: "Transportation", color: "#3B82F6", icon: "🚗" },
    { id: "3", name: "Shopping", color: "#8B5CF6", icon: "🛍️" },
    { id: "4", name: "Entertainment", color: "#F59E0B", icon: "🎬" },
    { id: "5", name: "Bills & Utilities", color: "#EF4444", icon: "💡" },
    { id: "6", name: "Healthcare", color: "#06B6D4", icon: "🏥" },
  ];

  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        const response = await fetch("/api/budgets");
        const data = await response.json();
        setBudgets(data);
      } catch (error) {
        console.error("Error fetching budgets:", error);
      }
    };

    fetchBudgets();
  }, []);

  const processReceiptOCR = async (receiptId: string, file: File) => {
    try {
      console.log("🧠 Starting AI vision analysis for:", file.name);

      // Step 1: Analyze image using AI vision (like how I read images)
      const visionResult = await visionReceiptReader.analyzeReceipt(file);
      console.log("✅ AI vision analysis completed:", {
        storeName: visionResult.storeName,
        total: visionResult.formattedTotal,
        itemCount: visionResult.items.length,
        confidence: visionResult.confidence,
      });

      // Step 2: Format the results for display
      const formattedItems = visionResult.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        currency: "INR",
        formattedPrice: item.formattedPrice,
        formattedUnitPrice: `₹${item.unitPrice.toFixed(2)}`,
        formattedTotalPrice: item.formattedPrice,
      }));

      // Create updated receipt with vision analysis results
      const updatedReceipt = {
        id: receiptId,
        fileName: file.name,
        filePath: `/uploads/receipts/${file.name}`,
        fileType: file.type,
        extractedText: `AI Vision Analysis Complete\n\nStore: ${visionResult.storeName}\nDate: ${visionResult.date}\nItems: ${visionResult.items.length}\nTotal: ${visionResult.formattedTotal}\nPayment: ${visionResult.paymentMethod}`,
        vendor: visionResult.storeName,
        storeName: visionResult.storeName,
        storeAddress: visionResult.storeAddress,
        totalAmount: visionResult.total,
        formattedTotal: visionResult.formattedTotal,
        date: visionResult.date,
        items: formattedItems,
        receiptNumber: visionResult.receiptNumber,
        paymentMethod: visionResult.paymentMethod,
        ocrConfidence: visionResult.confidence,
        processingTime: 1500,
        processed: true,
        createdAt: new Date().toISOString(),
      };

      // Update receipts list with the processed receipt
      setReceipts((prev) =>
        prev.map((receipt) =>
          receipt.id === receiptId ? updatedReceipt : receipt,
        ),
      );

      // Set the selected receipt and open the expense form
      setSelectedReceipt(updatedReceipt);
      // Format the date to YYYY-MM-DD format for the date input
      const formatDate = (dateString: string | undefined) => {
        if (!dateString) return new Date().toISOString().split("T")[0];
        try {
          const date = new Date(dateString);
          return isNaN(date.getTime())
            ? new Date().toISOString().split("T")[0]
            : date.toISOString().split("T")[0];
        } catch (e) {
          return new Date().toISOString().split("T")[0];
        }
      };

      setFormData((prev) => ({
        ...prev,
        description: updatedReceipt.storeName || "Receipt Purchase",
        amount: updatedReceipt.totalAmount?.toString() || "0",
        date: formatDate(updatedReceipt.date),
      }));
      setShowAddForm(true);
    } catch (error) {
      console.error("❌ AI vision analysis failed:", error);
      setReceipts((prev) =>
        prev.map((receipt) =>
          receipt.id === receiptId
            ? {
                ...receipt,
                processed: true,
                extractedText: `AI vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                vendor: "Processing Failed",
              }
            : receipt,
        ),
      );
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-gray-900 px-4 sm:px-6 lg:px-8 py-6">
        <div className="sm:flex sm:items-center mb-8">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-white">Receipt Scanner</h1>
            <p className="mt-2 text-sm text-gray-400">
              Upload receipts and automatically extract expense details using AI
              Vision
            </p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 transition-colors duration-200 ${
            dragActive
              ? "border-cyan-400 bg-cyan-900/20"
              : "border-gray-600 hover:border-gray-500"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="text-center">
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-lg font-medium text-white">
                {isUploading ? "Uploading..." : "Drop receipt files here"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                or click to browse (JPEG, PNG, PDF up to 10MB)
              </p>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-cyan-500 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-900 disabled:opacity-50 transition-colors duration-200"
              >
                <CameraIcon className="h-4 w-4 mr-2" />
                {isUploading ? "Processing..." : "Select Files"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipts List */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-6">
          Recent Receipts
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-400">
              Loading receipts...
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-2xl border border-gray-700">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-400">
              No receipts
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading your first receipt.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-gray-800 rounded-2xl border border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-cyan-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white truncate max-w-40">
                        {receipt.fileName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(receipt.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      receipt.processed
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {receipt.processed ? "Processed" : "Processing..."}
                  </span>
                </div>

                {receipt.processed && receipt.vendor && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-400">Vendor</p>
                      <p className="text-sm text-white font-medium">
                        {receipt.vendor}
                      </p>
                      {receipt.storeAddress && (
                        <p className="text-xs text-gray-400 mt-1">
                          {receipt.storeAddress}
                        </p>
                      )}
                    </div>

                    {(receipt.totalAmount || receipt.formattedTotal) && (
                      <div>
                        <p className="text-xs text-gray-400">Amount</p>
                        <p className="text-lg text-cyan-400 font-bold">
                          {receipt.formattedTotal ||
                            (receipt.totalAmount
                              ? `₹${receipt.totalAmount.toFixed(2)}`
                              : "N/A")}
                        </p>
                      </div>
                    )}

                    {receipt.date && (
                      <div>
                        <p className="text-xs text-gray-400">Date</p>
                        <p className="text-sm text-white">
                          {new Date(receipt.date).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Show additional receipt details */}
                    {(receipt.receiptNumber || receipt.paymentMethod) && (
                      <div className="flex space-x-4 text-xs">
                        {receipt.receiptNumber && (
                          <div>
                            <p className="text-gray-400">Receipt #</p>
                            <p className="text-white">
                              {receipt.receiptNumber}
                            </p>
                          </div>
                        )}
                        {receipt.paymentMethod && (
                          <div>
                            <p className="text-gray-400">Payment</p>
                            <p className="text-white">
                              {receipt.paymentMethod}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show OCR confidence if available */}
                    {receipt.ocrConfidence && (
                      <div className="text-xs">
                        <p className="text-gray-400">AI Vision Quality</p>
                        <p
                          className={`${
                            receipt.ocrConfidence > 80
                              ? "text-green-400"
                              : receipt.ocrConfidence > 60
                                ? "text-yellow-400"
                                : "text-red-400"
                          }`}
                        >
                          {receipt.ocrConfidence.toFixed(1)}% confidence
                        </p>
                      </div>
                    )}

                    {/* Show items count if available */}
                    <div className="bg-gray-700 rounded-lg p-3">
                      <button
                        onClick={() => handleCreateExpense(receipt)}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Create Expense
                      </button>
                    </div>

                    {!receipt.processed && (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                        <span className="ml-2 text-gray-400">
                          AI Vision Processing...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Expense Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-gray-600 w-96 shadow-2xl rounded-2xl bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-white mb-4">
                  Add Expense from Receipt
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                      placeholder="Enter expense description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Amount
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 sm:text-sm">₹</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        className="block w-full pl-7 rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Category
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) =>
                        setFormData({ ...formData, categoryId: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                      required
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
                    <label className="block text-sm font-medium text-gray-300">
                      Budget (Optional)
                    </label>
                    <select
                      value={formData.budgetId}
                      onChange={(e) =>
                        setFormData({ ...formData, budgetId: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">No budget (general expense)</option>
                      {budgets.map((budget) => {
                        const remaining = budget.amount - budget.spent;
                        const isOverBudget = remaining < 0;
                        return (
                          <option
                            key={budget.id}
                            value={budget.id}
                            disabled={isOverBudget}
                          >
                            {budget.name} - ₹{remaining.toFixed(2)} remaining
                            {budget.categoryName
                              ? ` (${budget.categoryName})`
                              : ""}
                            {isOverBudget ? " (Over budget)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
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
                      onClick={() => {
                        setShowAddForm(false);
                        setSelectedReceipt(null);
                      }}
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
      </div>
    </DashboardLayout>
  );
}
