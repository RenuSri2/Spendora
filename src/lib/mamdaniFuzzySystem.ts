// Implementation of a simple Mamdani Fuzzy Inference System

type FuzzySet = {
  [key: string]: number[];
};

type FuzzySets = {
  [key: string]: FuzzySet;
};

type RuleCondition = {
  [key: string]: string[];
};

type RuleOutput = {
  [key: string]: string[];
};

type Rule = {
  conditions: RuleCondition;
  outputs: RuleOutput;
};

type Inputs = {
  budgetUtilization: number;
  spendingTrend: number;
  savingsRate: number;
};

type Outputs = {
  tipPriority: number;
  mascotMood: number;
};

type FuzzifiedInputs = {
  [key: string]: { [key: string]: number };
};

type AggregatedOutput = {
  [key: string]: { [key: string]: number };
};

// Membership function for triangular and trapezoidal fuzzy sets
const membership = (x: number, params: number[]): number => {
  if (params.length === 3) {
    // Triangular membership function [a, b, c]
    const [a, b, c] = params;
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x < b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  } else {
    // Trapezoidal membership function [a, b, c, d]
    const [a, b, c, d] = params;
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    if (x < b) return (x - a) / (b - a);
    return (d - x) / (d - c);
  }
};

// Define linguistic variables and their membership functions
const fuzzySets: FuzzySets = {
  // Input: Budget Utilization (0-100%)
  budgetUtilization: {
    LOW: [0, 0, 25, 50],
    MEDIUM: [25, 50, 65, 80],
    HIGH: [65, 80, 90, 95],
    CRITICAL: [90, 95, 100, 100],
  },
  
  // Input: Spending Trend (percentage change)
  spendingTrend: {
    DOWN: [-100, -100, -15, 0],
    STABLE: [-15, 0, 15],
    UP: [0, 15, 100, 100],
  },
  
  // Input: Savings Rate (0-100%)
  savingsRate: {
    LOW: [0, 0, 10, 20],
    HEALTHY: [10, 20, 30, 40],
    EXCELLENT: [30, 40, 100, 100],
  },
  
  // Output: Tip Priority (0-100)
  tipPriority: {
    LOW: [0, 0, 25, 50],
    MEDIUM: [25, 50, 75],
    HIGH: [50, 75, 100],
    CRITICAL: [75, 100, 100, 100],
  },
  
  // Output: Mascot Mood (0-100)
  mascotMood: {
    HAPPY: [0, 0, 30, 60],
    CONCERNED: [50, 70, 100, 100],
    CELEBRATING: [20, 40, 70, 90],
  },
};

// Define fuzzy rules
const rules: Rule[] = [
  // Critical Priority Rules
  {
    conditions: {
      budgetUtilization: ["CRITICAL"],
    },
    outputs: {
      tipPriority: ["CRITICAL"],
      mascotMood: ["CONCERNED"],
    },
  },
  {
    conditions: {
      budgetUtilization: ["HIGH"],
      spendingTrend: ["UP"],
    },
    outputs: {
      tipPriority: ["CRITICAL"],
      mascotMood: ["CONCERNED"],
    },
  },
  
  // High Priority Rules
  {
    conditions: {
      budgetUtilization: ["HIGH"],
      spendingTrend: ["STABLE"],
    },
    outputs: {
      tipPriority: ["HIGH"],
      mascotMood: ["CONCERNED"],
    },
  },
  {
    conditions: {
      savingsRate: ["LOW"],
      budgetUtilization: ["MEDIUM"],
    },
    outputs: {
      tipPriority: ["HIGH"],
      mascotMood: ["CONCERNED"],
    },
  },
  
  // Medium Priority Rules
  {
    conditions: {
      spendingTrend: ["UP"],
      budgetUtilization: ["MEDIUM"],
    },
    outputs: {
      tipPriority: ["MEDIUM"],
      mascotMood: ["HAPPY"],
    },
  },
  {
    conditions: {
      savingsRate: ["HEALTHY"],
      spendingTrend: ["DOWN"],
    },
    outputs: {
      tipPriority: ["MEDIUM"],
      mascotMood: ["CELEBRATING"],
    },
  },

  // Low Priority Rules
  {
    conditions: {
      budgetUtilization: ["LOW"],
      spendingTrend: ["STABLE"],
    },
    outputs: {
      tipPriority: ["LOW"],
      mascotMood: ["HAPPY"],
    },
  },
  {
    conditions: {
      savingsRate: ["EXCELLENT"],
    },
    outputs: {
      tipPriority: ["LOW"],
      mascotMood: ["CELEBRATING"],
    },
  },
];

// Fuzzify inputs
const fuzzify = (inputs: Inputs): FuzzifiedInputs => {
  const fuzzified: FuzzifiedInputs = {};
  
  // Fuzzify each input variable
  for (const [varName, value] of Object.entries(inputs)) {
    fuzzified[varName] = {};
    const fuzzySet = fuzzySets[varName];
    
    // Calculate membership for each linguistic term
    for (const [term, params] of Object.entries(fuzzySet)) {
      fuzzified[varName][term] = membership(value, params);
    }
  }
  
  return fuzzified;
};

// Apply fuzzy rules to get output strengths
const applyRules = (fuzzified: FuzzifiedInputs): AggregatedOutput => {
  const outputStrengths: AggregatedOutput = {
    tipPriority: {},
    mascotMood: {},
  };
  
  // Initialize output strengths to 0
  Object.keys(fuzzySets.tipPriority).forEach(term => {
    outputStrengths.tipPriority[term] = 0;
  });
  Object.keys(fuzzySets.mascotMood).forEach(term => {
    outputStrengths.mascotMood[term] = 0;
  });
  
  // Apply each rule
  for (const rule of rules) {
    // Calculate rule strength using AND (min) of all conditions
    let ruleStrength = 1;
    
    for (const [varName, terms] of Object.entries(rule.conditions)) {
      const maxTermStrength = Math.max(
        ...terms.map(term => fuzzified[varName]?.[term] || 0)
      );
      ruleStrength = Math.min(ruleStrength, maxTermStrength);
    }
    
    // Apply rule strength to each output
    for (const [outputVar, terms] of Object.entries(rule.outputs)) {
      for (const term of terms) {
        outputStrengths[outputVar][term] = Math.max(
          outputStrengths[outputVar][term] || 0,
          ruleStrength
        );
      }
    }
  }
  
  return outputStrengths;
};

// Defuzzify using centroid method
const defuzzify = (outputStrengths: AggregatedOutput, outputVar: string): number => {
  const fuzzySet = fuzzySets[outputVar];
  const steps = 100;
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100; // Scale to 0-100 range
    let maxMembership = 0;
    
    // Find maximum membership at this x for all terms
    for (const [term, params] of Object.entries(fuzzySet)) {
      const termStrength = outputStrengths[outputVar][term] || 0;
      if (termStrength > 0) {
        const mf = membership(x, params);
        const clipped = Math.min(mf, termStrength);
        maxMembership = Math.max(maxMembership, clipped);
      }
    }
    
    numerator += x * maxMembership;
    denominator += maxMembership;
  }
  
  // Avoid division by zero
  return denominator > 0 ? numerator / denominator : 50; // Default to 50 if no rules fired
};

// Main function to run the fuzzy inference system
export const runFuzzyInference = (inputs: Inputs): Outputs => {
  // 1. Fuzzify inputs
  const fuzzified = fuzzify(inputs);
  
  // 2. Apply rules to get output strengths
  const outputStrengths = applyRules(fuzzified);
  
  // 3. Defuzzify outputs
  const tipPriority = defuzzify(outputStrengths, 'tipPriority');
  const mascotMood = defuzzify(outputStrengths, 'mascotMood');
  
  return {
    tipPriority,
    mascotMood,
  };
};

// Helper function to get linguistic term for a value
export const getLinguisticTerm = (value: number, variable: string): string => {
  const fuzzySet = fuzzySets[variable];
  if (!fuzzySet) return 'UNKNOWN';
  
  let maxMembership = -1;
  let bestTerm = '';
  
  for (const [term, params] of Object.entries(fuzzySet)) {
    const mf = membership(value, params);
    if (mf > maxMembership) {
      maxMembership = mf;
      bestTerm = term;
    }
  }
  
  return bestTerm;
};

// Example usage:
/*
const inputs = {
  budgetUtilization: 85,    // 85% budget utilization
  spendingTrend: 10,        // 10% spending increase
  savingsRate: 25,          // 25% savings rate
};

const results = runFuzzyInference(inputs);
console.log('Tip Priority:', results.tipPriority, getLinguisticTerm(results.tipPriority, 'tipPriority'));
console.log('Mascot Mood:', results.mascotMood, getLinguisticTerm(results.mascotMood, 'mascotMood'));
*/
