// Reliable Free OCR Receipt Scanner
// Uses Tesseract.js with optimized settings for receipt processing
// No API keys required - completely free and client-side processing

import Tesseract from 'tesseract.js'

export interface VisionReceiptResult {
  storeName: string
  storeAddress?: string
  date: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    formattedPrice: string
  }>
  subtotal?: number
  tax?: number
  total: number
  formattedTotal: string
  paymentMethod?: string
  receiptNumber?: string
  confidence: number
}

class VisionReceiptReader {
  private worker: Tesseract.Worker | null = null

  /**
   * Analyze any bill or receipt using free Tesseract.js OCR
   */
  async analyzeReceipt(imageFile: File): Promise<VisionReceiptResult> {
    console.log('🔍 Starting OCR analysis for:', imageFile.name, 'Size:', (imageFile.size / 1024).toFixed(1) + 'KB')
    
    try {
      // Validate file
      if (!this.isValidImageFile(imageFile)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, etc.)')
      }
      
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Image too large. Please use an image smaller than 10MB.')
      }
      
      // Step 1: Convert image to base64
      console.log('📷 Processing image...')
      const imageDataUrl = await this.fileToDataURL(imageFile)
      
      // Step 2: Run OCR
      console.log('🔍 Running OCR extraction...')
      const ocrText = await this.runSimpleOCR(imageDataUrl)
      
      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error('Could not extract any text from the image. Please ensure the image is clear and contains readable text.')
      }
      
      console.log('📝 OCR extracted', ocrText.length, 'characters')
      
      // Step 3: Parse the extracted text
      console.log('🧠 Analyzing text...')
      const result = this.parseReceiptTextSimple(ocrText)
      
      console.log('✅ Analysis complete:', {
        store: result.storeName,
        items: result.items.length,
        total: result.formattedTotal
      })
      
      return result
      
    } catch (error) {
      console.error('❌ Analysis failed:', error)
      throw error
    }
  }

  /**
   * Validate if the uploaded file is a valid image
   */
  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
    return validTypes.includes(file.type.toLowerCase())
  }

  /**
   * Convert file to data URL for processing
   */
  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read image file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Simple, reliable OCR using Tesseract.js
   */
  private async runSimpleOCR(imageDataUrl: string): Promise<string> {
    let worker: Tesseract.Worker | null = null
    
    try {
      console.log('🔄 Initializing Tesseract worker...')
      worker = await Tesseract.createWorker()
      
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      
      console.log('🔍 Processing image with OCR...')
      const { data } = await worker.recognize(imageDataUrl)
      
      console.log('✅ OCR completed with', data.confidence.toFixed(1) + '% confidence')
      
      return data.text || ''
      
    } catch (error) {
      console.error('❌ OCR failed:', error)
      throw new Error('Text extraction failed. Please try with a clearer image.')
    } finally {
      if (worker) {
        await worker.terminate()
      }
    }
  }

  /**
   * Simple parser that extracts key information from OCR text
   */
  private parseReceiptTextSimple(text: string): VisionReceiptResult {
    console.log('🧠 Parsing OCR text:', text.substring(0, 200) + '...')
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Extract store name (usually first few lines)
    let storeName = 'Receipt'
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i]
      if (line.length > 3 && !/^[\d\s.,:-]+$/.test(line) && !line.toLowerCase().includes('phone')) {
        storeName = line
        break
      }
    }
    
    // Extract items and prices
    const items: Array<{
      name: string
      quantity: number
      unitPrice: number
      totalPrice: number
      formattedPrice: string
    }> = []
    
    let total = 0
    let foundTotal = false
    
    for (const line of lines) {
      // Look for total amount
      if (line.toLowerCase().includes('total') && !foundTotal) {
        const matches = line.match(/([\d,.]+)/g)
        if (matches) {
          const amount = parseFloat(matches[matches.length - 1].replace(/[,]/g, ''))
          if (amount > 0) {
            total = amount
            foundTotal = true
          }
        }
      }
      
      // Look for item lines with prices
      else if (!this.isHeaderOrFooterLine(line)) {
        const priceMatch = line.match(/(.+?)\s+([\d,.]+)\s*$/)
        if (priceMatch) {
          const [, itemName, priceStr] = priceMatch
          const price = parseFloat(priceStr.replace(/[,]/g, ''))
          
          if (price > 0 && itemName.trim().length > 1) {
            items.push({
              name: itemName.trim(),
              quantity: 1,
              unitPrice: price,
              totalPrice: price,
              formattedPrice: `₹${price.toFixed(2)}`
            })
          }
        }
      }
    }
    
    // If no total found, calculate from items
    if (!foundTotal && items.length > 0) {
      total = items.reduce((sum, item) => sum + item.totalPrice, 0)
    }
    
    // If still no items or total, create a basic receipt
    if (items.length === 0 && total === 0) {
      // Look for any numbers that might be prices
      const allNumbers = text.match(/\b\d{1,4}\.?\d{0,2}\b/g) || []
      const prices = allNumbers
        .map(n => parseFloat(n))
        .filter(n => n > 0 && n < 10000)
        .sort((a, b) => b - a)
      
      if (prices.length > 0) {
        total = prices[0] // Use largest number as total
        
        // Create dummy items
        for (let i = 0; i < Math.min(3, prices.length); i++) {
          items.push({
            name: `Item ${i + 1}`,
            quantity: 1,
            unitPrice: prices[i],
            totalPrice: prices[i],
            formattedPrice: `₹${prices[i].toFixed(2)}`
          })
        }
      }
    }
    
    const confidence = this.calculateSimpleConfidence(text, items, total)
    
    return {
      storeName,
      date: new Date().toLocaleDateString('en-GB'),
      items,
      total,
      formattedTotal: `₹${total.toFixed(2)}`,
      confidence
    }
  }
  
  private isHeaderOrFooterLine(line: string): boolean {
    const skipPatterns = [
      /^[\d\s.:-]+$/,
      /phone|tel|email|address|thank|visit|welcome|receipt/i,
      /^\s*$/, 
      /^.{1,2}$/
    ]
    
    return skipPatterns.some(pattern => pattern.test(line))
  }
  
  private calculateSimpleConfidence(text: string, items: any[], total: number): number {
    let confidence = 50
    
    if (text.length > 50) confidence += 10
    if (text.length > 200) confidence += 10
    if (items.length > 0) confidence += 15
    if (items.length >= 2) confidence += 10
    if (total > 0) confidence += 15
    
    return Math.min(95, confidence)
  }

}

/**
 * Add an expense from receipt data
 * @param receipt The receipt analysis result
 * @param budgetId The ID of the budget to associate with this expense
 * @param category The category for the expense
 * @param description Optional description (defaults to store name)
 * @returns The created expense object
 */
async function addExpenseFromReceipt(
  receipt: VisionReceiptResult,
  budgetId: string,
  category: string,
  description?: string
) {
  try {
    const expense = {
      amount: receipt.total,
      description: description || receipt.storeName,
      category,
      budgetId,
      date: new Date().toISOString().split('T')[0],
      receiptData: {
        storeName: receipt.storeName,
        items: receipt.items,
        total: receipt.total,
        date: receipt.date
      }
    }

    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expense),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add expense');
    }

    const createdExpense = await response.json();
    console.log('✅ Expense added:', createdExpense);
    
    return createdExpense;
  } catch (error) {
    console.error('❌ Failed to add expense from receipt:', error);
    throw error;
  }
}

// Export singleton instance and the new function
export const visionReceiptReader = new VisionReceiptReader()
export { addExpenseFromReceipt }
