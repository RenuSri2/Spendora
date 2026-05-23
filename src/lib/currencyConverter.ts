// Currency Service for Indian Receipts
// Handles Indian Rupee (INR) formatting and validation

export interface CurrencyResult {
  amount: number
  currency: string
  formattedAmount: string
}

class CurrencyService {
  private readonly CURRENCY = 'INR'
  private readonly SYMBOL = '₹'

  /**
   * Format amount in Indian Rupees
   */
  formatINR(amount: number): string {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  /**
   * Parse price from Indian receipt text
   */
  parseINRFromText(text: string): number {
    // Look for rupee symbol or common price patterns
    const patterns = [
      /₹\s*([\d,]+\.?\d*)/g,        // ₹1,234.56
      /RS\.?\s*([\d,]+\.?\d*)/gi,   // RS. 1234 or RS 1234
      /INR\s*([\d,]+\.?\d*)/gi,     // INR 1234
      /([\d,]+\.?\d*)\s*₹/g,       // 1234₹
      /\b([\d,]+\.\d{2})\b/g        // Generic decimal prices
    ]

    for (const pattern of patterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          const numberMatch = match.match(/([\d,]+\.?\d*)/)
          if (numberMatch) {
            const amount = parseFloat(numberMatch[1].replace(/,/g, ''))
            if (amount > 0) {
              return amount
            }
          }
        }
      }
    }

    return 0
  }

  /**
   * Process and format Indian Rupee amount
   */
  processINRAmount(amount: number): CurrencyResult {
    return {
      amount,
      currency: this.CURRENCY,
      formattedAmount: this.formatINR(amount)
    }
  }

  /**
   * Detect if text contains Indian currency
   */
  detectINRInText(text: string): boolean {
    const currencyIndicators = ['₹', 'rs.', 'rs ', 'inr', 'rupee', 'rupees']
    const lowerText = text.toLowerCase()
    return currencyIndicators.some(indicator => lowerText.includes(indicator))
  }
}

// Export singleton instance
export const currencyService = new CurrencyService()

// Export the service as currencyConverter for backward compatibility
export const currencyConverter = currencyService
