"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { runFuzzyInference, getLinguisticTerm } from "../lib/mamdaniFuzzySystem";

// Enhanced smart tip generation with advanced fuzzy logic
interface UserFinancialData {
  totalSpending: number;
  budget: number;
  savingsRate: number;
  topCategory: string;
  spendingTrend: "up" | "down" | "stable";
  categoryBreakdown: Record<string, number>;
  lastWeekSpending: number;
  monthlyGoal: number;
  savingsStreak: number;
  budgetUtilization: number;
  avgDailySpending: number;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category: string;
}

type MascotMood =
  | "happy"
  | "excited"
  | "concerned"
  | "sleeping"
  | "celebrating";

export default function MoneyBillMascot() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlinking, setIsBlinking] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [currentTip, setCurrentTip] = useState("");
  const [mood, setMood] = useState<MascotMood>("happy");
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const [tipPriority, setTipPriority] = useState<
    "low" | "medium" | "high" | "critical"
  >("low");
  const [dataSource, setDataSource] = useState<"api" | "mock">("mock");
  const [lastTipIndex, setLastTipIndex] = useState(0);
  const [tipRotationMode, setTipRotationMode] = useState<
    "priority" | "rotation"
  >("priority");

  // Process financial data using fuzzy logic
  const processFinancialData = useCallback((data: {
    totalSpending: number;
    budget: number;
    savingsRate: number;
    spendingTrend: "up" | "down" | "stable";
    budgetUtilization: number;
  }) => {
    // Convert spending trend to numerical value
    const trendValue = data.spendingTrend === 'up' ? 10 : data.spendingTrend === 'down' ? -10 : 0;
    
    // Prepare inputs for fuzzy inference
    const inputs = {
      budgetUtilization: data.budgetUtilization, // 0-100%
      spendingTrend: trendValue, // -100 to 100
      savingsRate: data.savingsRate, // 0-100%
    };

    // Run fuzzy inference
    const results = runFuzzyInference(inputs);
    
    // Get linguistic terms for outputs
    const priorityTerm = getLinguisticTerm(results.tipPriority, 'tipPriority').toLowerCase();
    const moodTerm = getLinguisticTerm(results.mascotMood, 'mascotMood').toLowerCase();
    
    // Map priority term to the expected type
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical'
    };
    
    // Map mood term to the MascotMood type
    const moodMap: Record<string, MascotMood> = {
      'happy': 'happy',
      'concerned': 'concerned',
      'celebrating': 'celebrating'
    };
    
    return {
      priority: priorityMap[priorityTerm] || 'medium',
      mood: moodMap[moodTerm] || 'happy',
      tipPriorityValue: results.tipPriority,
      mascotMoodValue: results.mascotMood
    };
  }, []);

  // Generate tip based on fuzzy logic results
  const generateSmartTip = useCallback((priority: string, mood: MascotMood) => {
    const tips = {
      critical: [
        "🚨 Your spending is critical! Let's review your budget together.",
        "⚠️ High spending alert! Consider cutting back on non-essentials.",
        "💸 Your budget is under pressure. Let's find ways to save more."
      ],
      high: [
        "📈 Your spending is trending up. Let's keep an eye on your budget.",
        "💡 Consider optimizing your spending in the next few days.",
        "🔍 Let's review your recent expenses to find savings opportunities."
      ],
      medium: [
        "👍 You're doing well! A few tweaks could help you save even more.",
        "📊 Your spending is on track. Keep monitoring your budget.",
        "💡 Small changes can lead to big savings over time."
      ],
      low: [
        "🎉 Great job! Your finances are looking healthy!",
        "🌟 You're making excellent financial decisions. Keep it up!",
        "💪 Your savings are on point! Consider increasing your investment."
      ]
    };

    const moodEmoji = {
      happy: '😊',
      excited: '😃',
      concerned: '😟',
      sleeping: '😴',
      celebrating: '🎉'
    };

    const moodTips = {
      happy: ["Looking good!", "Keep it up!", "You're on track!"],
      excited: ["Amazing!", "Fantastic progress!", "You're crushing it!"],
      concerned: ["Let's review...", "Time to check in", "Let's adjust"],
      sleeping: ["All quiet", "Steady as she goes", "On track"],
      celebrating: ["Amazing!", "Incredible!", "Outstanding!"]
    };

    const priorityTips = tips[priority as keyof typeof tips] || ["Keep up the good work!"].concat(tips.low);
    const moodTip = moodTips[mood]?.[Math.floor(Math.random() * moodTips[mood].length)] || "";
    
    const selectedTip = priorityTips[Math.floor(Math.random() * priorityTips.length)];
    return `${moodEmoji[mood] || '✨'} ${selectedTip} ${moodTip}`.trim();
  }, []);

  // Load data from your existing API routes
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      console.log("🔄 Money Mascot: Starting data fetch...");
      console.log("📍 Fetching from:", {
        expenses: "/api/expenses",
        budgets: "/api/budgets",
      });

      try {
        // Use your existing API routes
        const [expensesRes, budgetsRes] = await Promise.all([
          fetch("/api/expenses"),
          fetch("/api/budgets"),
        ]);

        console.log("📊 API Response Status:", {
          expenses: expensesRes.status,
          budgets: budgetsRes.status,
          expensesOk: expensesRes.ok,
          budgetsOk: budgetsRes.ok,
        });

        if (expensesRes.ok && budgetsRes.ok) {
          const [expensesData, budgetsData] = await Promise.all([
            expensesRes.json(),
            budgetsRes.json(),
          ]);

          console.log("📦 Raw API Response:", {
            expensesData,
            budgetsData,
            expensesIsArray: Array.isArray(expensesData),
            budgetsIsArray: Array.isArray(budgetsData),
          });

          // Your API returns the data directly as arrays
          let expenses = expensesData;
          let budgets = budgetsData;

          // Handle if wrapped in an object (just in case)
          if (!Array.isArray(expensesData)) {
            expenses = expensesData?.expenses || expensesData?.data || [];
          }
          if (!Array.isArray(budgetsData)) {
            budgets = budgetsData?.budgets || budgetsData?.data || [];
          }

          if (Array.isArray(expenses) && Array.isArray(budgets)) {
            if (isMounted) {
              setExpenses(expenses);
              setBudgets(budgets);
              setDataSource("api");

              console.log("✅ DATA SOURCE: USING YOUR REAL DATA FROM API");
              console.log("📈 Loaded Data Summary:", {
                totalExpenses: expenses.length,
                totalBudgets: budgets.length,
                expensesPreview: expenses.slice(0, 3),
                budgetsPreview: budgets.slice(0, 3),
              });

              // Calculate totals for logging
              const totalSpending = expenses.reduce(
                (sum, e) => sum + (e.amount || 0),
                0,
              );
              const totalBudget = budgets.reduce(
                (sum, b) => sum + (b.amount || 0),
                0,
              );
              const totalSpent = budgets.reduce(
                (sum, b) => sum + (b.spent || 0),
                0,
              );

              console.log("💰 Financial Summary:", {
                totalSpending: `₹${totalSpending}`,
                totalBudget: `₹${totalBudget}`,
                totalSpent: `₹${totalSpent}`,
                budgetUtilization: `${((totalSpent / totalBudget) * 100).toFixed(1)}%`,
              });
            }
          } else {
            console.error("❌ Data is not in array format:", {
              expenses,
              budgets,
            });
            throw new Error("Invalid data format - expected arrays");
          }
        } else {
          throw new Error(
            `HTTP Error: expenses ${expensesRes.status}, budgets ${budgetsRes.status}`,
          );
        }
      } catch (error) {
        console.error("❌ Error loading data from API:", error);
        console.warn("⚠️ Falling back to MOCK DATA");

        // Fallback to mock data
        if (isMounted) {
          const mockExpenses: Expense[] = [
            {
              id: "1",
              description: "Starbucks Coffee",
              amount: 250,
              category: "Food & Dining",
              date: "2025-10-14",
            },
            {
              id: "2",
              description: "Grocery Shopping",
              amount: 1500,
              category: "Food & Dining",
              date: "2025-10-13",
            },
            {
              id: "3",
              description: "Uber Ride",
              amount: 180,
              category: "Transportation",
              date: "2025-10-12",
            },
            {
              id: "4",
              description: "Movie Tickets",
              amount: 600,
              category: "Entertainment",
              date: "2025-10-11",
            },
            {
              id: "5",
              description: "New Shoes",
              amount: 2500,
              category: "Shopping",
              date: "2025-10-10",
            },
            {
              id: "6",
              description: "Restaurant Dinner",
              amount: 800,
              category: "Food & Dining",
              date: "2025-10-09",
            },
            {
              id: "7",
              description: "Gas Station",
              amount: 500,
              category: "Transportation",
              date: "2025-10-08",
            },
          ];

          const mockBudgets: Budget[] = [
            {
              id: "1",
              name: "Food & Dining",
              amount: 5000,
              spent: 2550,
              category: "Food",
            },
            {
              id: "2",
              name: "Transportation",
              amount: 2000,
              spent: 680,
              category: "Transport",
            },
            {
              id: "3",
              name: "Entertainment",
              amount: 1500,
              spent: 600,
              category: "Entertainment",
            },
            {
              id: "4",
              name: "Shopping",
              amount: 3000,
              spent: 2500,
              category: "Shopping",
            },
          ];

          setExpenses(mockExpenses);
          setBudgets(mockBudgets);
          setDataSource("mock");

          console.log("🎭 DATA SOURCE: USING MOCK DATA (API Failed)");
          console.log("📊 Mock Data Summary:", {
            totalExpenses: mockExpenses.length,
            totalBudgets: mockBudgets.length,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log("✅ Money Mascot: Data loading complete!");
          console.log("═══════════════════════════════════════");
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [processFinancialData, generateSmartTip]);

  // Calculate financial data from expenses and budgets
  const financialData = useMemo(() => {
    const totalSpending = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);

    const categoryBreakdown = expenses.reduce((acc, expense) => {
      if (expense?.category) {
        acc[expense.category] = (acc[expense.category] || 0) + (expense.amount || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryBreakdown).reduce(
      (max, [category, amount]) =>
        amount > max.amount ? { category, amount } : max,
      { category: "None", amount: 0 }
    ).category;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const lastWeekSpending = expenses
      .filter((e) => new Date(e.date) >= sevenDaysAgo)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const previousWeekSpending = expenses
      .filter((e) => {
        const date = new Date(e.date);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    let spendingTrend: "up" | "down" | "stable" = "stable";
    if (previousWeekSpending > 0) {
      const change = ((lastWeekSpending - previousWeekSpending) / previousWeekSpending) * 100;
      if (change > 15) spendingTrend = "up";
      else if (change < -15) spendingTrend = "down";
    }

    const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const avgDailySpending = expenses.length > 0 ? totalSpending / 30 : 0;
    const savingsRate = totalBudget > 0 ? Math.round(((totalBudget - totalSpent) / totalBudget) * 100) : 0;

    return {
      totalSpending,
      budget: totalBudget,
      savingsRate,
      topCategory,
      spendingTrend,
      categoryBreakdown,
      lastWeekSpending,
      monthlyGoal: totalBudget,
      savingsStreak: 1,
      budgetUtilization,
      avgDailySpending,
    };
  }, [expenses, budgets]);

  // ADVANCED FUZZY LOGIC TIP GENERATION
  const generateSmartTips = useCallback((): {
    tip: string;
    priority: "low" | "medium" | "high" | "critical";
    mood: MascotMood;
  }[] => {
    const userData = financialData;

    const spendingTrendNumeric =
      userData.spendingTrend === "up"
        ? 10
        : userData.spendingTrend === "down"
          ? -10
          : 0;

    const fuzzyResult = processFinancialData({
      totalSpending: userData.totalSpending,
      budget: userData.budget,
      savingsRate: userData.savingsRate,
      spendingTrend: userData.spendingTrend,
      budgetUtilization: userData.budgetUtilization,
    });

    const tipMapping = {
      CRITICAL: [
        "🚨 CRITICAL: You've spent 95%+ of your budget! Time to pause all non-essential spending.",
        `⚠️ ${userData.topCategory} budget is almost full! Consider cutting back.`,
      ],
      HIGH: [
        `⚠️ Spending is ${Math.round(userData.budgetUtilization)}% of your budget. Limit to ₹${Math.round(userData.avgDailySpending)}/day.`,
        `📈 Spending is trending UP! Last week: ₹${userData.lastWeekSpending.toFixed(0)}. Time to slow down!`,
        `💰 Savings rate is only ${userData.savingsRate}%! Aim for at least 20% to build emergency funds.`,
      ],
      MEDIUM: [
        `🍽️ Dining is a large part of your spending. Meal prep could save you money.`,
        `🛍️ Shopping is a significant expense. Try the 30-day rule: wait before buying.`,
        `🚗 Transport costs are high. Consider carpooling or public transport.`,
        `🎉 Amazing! You're spending less than your budget. Keep it up!`,
      ],
      LOW: [
        "🎉 Weekend vibes! Plan free activities like parks or game nights to avoid impulse spending.",
        "☕ Morning tip: Pack your lunch today! Average savings: ₹200-400 per day.",
        "🌙 Evening tip: Online shopping cart full? Sleep on it! 80% of late-night purchases are regretted.",
        "💡 Rule of 72: Divide 72 by your interest rate to see how long to double your money!",
        "📈 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings!",
      ],
    };

    const moodMapping = {
      CONCERNED: "concerned",
      CELEBRATING: "celebrating",
      HAPPY: "happy",
    };

    const priorityValue = fuzzyResult.priority.toUpperCase() as keyof typeof tipMapping;
    const priority = priorityValue in tipMapping ? priorityValue : 'MEDIUM';
    const moodValue = fuzzyResult.mood.toUpperCase() as keyof typeof moodMapping;
    const mood = moodMapping[moodValue] || "happy";

    const tips = tipMapping[priority].map((tip) => ({
      tip,
      priority: priority.toLowerCase() as
        | "low"
        | "medium"
        | "high"
        | "critical",
      mood: mood as MascotMood,
    }));

    return tips;
  }, [financialData, processFinancialData]);

  const allTips = useMemo(() => generateSmartTips(), [generateSmartTips]);

  // Auto-sleep after inactivity
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      if (Date.now() - lastInteraction > 15000 && mood !== "sleeping") {
        setMood("sleeping");
        setShowTip(false);
      }
    }, 1000);

    return () => clearInterval(checkInactivity);
  }, [lastInteraction, mood]);

  // Blinking animation
  useEffect(() => {
    if (mood === "sleeping") return;

    const blinkInterval = setInterval(
      () => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      },
      3000 + Math.random() * 3000,
    );

    return () => clearInterval(blinkInterval);
  }, [mood]);

  // Show smart tip with better rotation through all tips
  const showRandomTip = useCallback(() => {
    if (mood === "sleeping") {
      setMood("happy");
      setLastInteraction(Date.now());
      return;
    }

    const criticalTips = allTips.filter((t) => t.priority === "critical");
    const highTips = allTips.filter((t) => t.priority === "high");
    const mediumTips = allTips.filter((t) => t.priority === "medium");
    const lowTips = allTips.filter((t) => t.priority === "low");

    let selectedTip;

    // Always prioritize critical tips if they exist
    if (criticalTips.length > 0) {
      selectedTip =
        criticalTips[Math.floor(Math.random() * criticalTips.length)];
    } else {
      // For non-critical tips, implement rotation to ensure all tips are shown
      const nonCriticalTips = [...highTips, ...mediumTips, ...lowTips];

      if (nonCriticalTips.length > 0) {
        // Cycle through tips systematically to ensure variety
        const nextIndex = (lastTipIndex + 1) % nonCriticalTips.length;
        setLastTipIndex(nextIndex);
        selectedTip = nonCriticalTips[nextIndex];
      } else {
        // Fallback to any available tip if no non-critical tips exist
        selectedTip = allTips[Math.floor(Math.random() * allTips.length)];
      }
    }

    console.log("💬 Showing Tip:", {
      priority: selectedTip.priority,
      mood: selectedTip.mood,
      tip: selectedTip.tip.substring(0, 50) + "...",
      totalTips: allTips.length,
      criticalCount: criticalTips.length,
      highCount: highTips.length,
      mediumCount: mediumTips.length,
      lowCount: lowTips.length,
      currentRotationIndex: lastTipIndex,
    });

    setCurrentTip(selectedTip.tip);
    setTipPriority(selectedTip.priority);
    setMood(selectedTip.mood);
    setShowTip(true);
    setLastInteraction(Date.now());

    setTimeout(() => {
      setShowTip(false);
      setMood("happy");
    }, 6000);
  }, [mood, allTips, lastTipIndex]);

  if (isLoading) {
    return null;
  }

  const getBorderColor = () => {
    switch (tipPriority) {
      case "critical":
        return "border-red-500";
      case "high":
        return "border-orange-500";
      case "medium":
        return "border-yellow-500";
      default:
        return "border-green-400";
    }
  };

  return (
    <div className="fixed bottom-6 right-15 z-50">
      <div
        className="relative cursor-pointer"
        onClick={showRandomTip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showRandomTip();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Money Bill Buddy - Click for financial tips"
      >
        {/* Data Source Indicator (appears briefly on hover) */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity">
          <span
            className={`text-xs font-bold px-2 py-1 rounded ${dataSource === "api" ? "bg-green-500 text-white" : "bg-orange-500 text-white"}`}
          >
            {dataSource === "api" ? "✓ Real Data" : "⚠ Mock Data"}
          </span>
        </div>

        {/* Speech bubble */}
        <AnimatePresence mode="wait">
          {showTip && (
            <motion.div
              className={`absolute -top-32 right-0 bg-white dark:bg-gray-800 text-xs p-4 rounded-2xl shadow-2xl w-64 border-3 ${getBorderColor()}`}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              role="tooltip"
              aria-live="polite"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTip(false);
                  setMood("happy");
                }}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors shadow-lg"
                aria-label="Close tip"
              >
                <X className="w-3 h-3" />
              </button>
              <p className="text-sm text-gray-800 dark:text-gray-100 font-medium pr-4 leading-relaxed">
                {currentTip}
              </p>
              <div
                className={`absolute -bottom-2 right-10 w-4 h-4 bg-white dark:bg-gray-800 transform rotate-45 border-r-3 border-b-3 ${getBorderColor()}`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Money Bill Mascot with FLOATING COINS */}
        <motion.div
          className="relative w-28 h-36"
          animate={{
            y:
              mood === "sleeping"
                ? [0, 3, 0]
                : mood === "celebrating"
                  ? [-12, -18, -12]
                  : mood === "excited"
                    ? [-6, -10, -6]
                    : [0, -8, 0],
            rotate:
              mood === "celebrating"
                ? [-6, 6, -6]
                : mood === "excited"
                  ? [-3, 3, -3]
                  : 0,
            scale:
              mood === "celebrating"
                ? [1, 1.08, 1]
                : mood === "excited"
                  ? [1, 1.04, 1]
                  : 1,
          }}
          transition={{
            y: {
              duration:
                mood === "sleeping"
                  ? 3.5
                  : mood === "celebrating"
                    ? 0.5
                    : mood === "excited"
                      ? 0.7
                      : 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            },
            rotate: {
              duration: 0.6,
              repeat:
                mood === "celebrating" || mood === "excited" ? Infinity : 0,
              ease: "easeInOut",
            },
            scale: {
              duration: 0.5,
              repeat:
                mood === "celebrating" || mood === "excited" ? Infinity : 0,
              ease: "easeInOut",
            },
          }}
        >
          {/* Shadow */}
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-3 bg-green-900/20 rounded-full blur-md"
            animate={{
              scale:
                mood === "sleeping"
                  ? [1, 0.95, 1]
                  : mood === "celebrating"
                    ? [1.3, 0.9, 1.3]
                    : [1, 0.9, 1],
              opacity:
                mood === "sleeping" ? [0.15, 0.1, 0.15] : [0.2, 0.3, 0.2],
            }}
            transition={{
              duration:
                mood === "sleeping" ? 3.5 : mood === "celebrating" ? 0.5 : 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* FLOATING COINS - Always visible in idle/happy state */}
          {(mood === "happy" || mood === "excited") && !showTip && (
            <>
              {/* Coin 1 - Top Left */}
              <motion.div
                className="absolute -top-6 -left-8 text-2xl drop-shadow-lg"
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 360],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                🪙
              </motion.div>

              {/* Coin 2 - Top Right */}
              <motion.div
                className="absolute -top-4 -right-10 text-xl drop-shadow-lg"
                animate={{
                  y: [0, -12, 0],
                  rotate: [0, -360],
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              >
                💰
              </motion.div>

              {/* Coin 3 - Bottom Left */}
              <motion.div
                className="absolute bottom-8 -left-10 text-xl drop-shadow-lg"
                animate={{
                  y: [0, 10, 0],
                  rotate: [0, 360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              >
                🪙
              </motion.div>

              {/* Coin 4 - Bottom Right */}
              <motion.div
                className="absolute bottom-6 -right-8 text-2xl drop-shadow-lg"
                animate={{
                  y: [0, 12, 0],
                  rotate: [0, -360],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5,
                }}
              >
                💵
              </motion.div>

              {/* Coin 5 - Middle Left */}
              <motion.div
                className="absolute top-12 -left-12 text-lg drop-shadow-lg"
                animate={{
                  x: [-3, 3, -3],
                  rotate: [0, 180, 360],
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.8,
                }}
              >
                💰
              </motion.div>

              {/* Coin 6 - Middle Right */}
              <motion.div
                className="absolute top-10 -right-12 text-lg drop-shadow-lg"
                animate={{
                  x: [3, -3, 3],
                  rotate: [0, -180, -360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3,
                }}
              >
                🪙
              </motion.div>
            </>
          )}

          {/* Main Money Bill Body */}
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Rectangle Money Bill Body */}
            <div className="relative w-24 h-32 bg-gradient-to-br from-emerald-400 via-green-500 to-green-600 rounded-2xl border-4 border-green-700 shadow-2xl overflow-hidden">
              {/* Bill details - corner circles */}
              <div className="absolute top-2 left-2 w-5 h-5 bg-green-600/30 rounded-full" />
              <div className="absolute top-2 right-2 w-5 h-5 bg-green-600/30 rounded-full" />
              <div className="absolute bottom-2 left-2 w-5 h-5 bg-green-600/30 rounded-full" />
              <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-600/30 rounded-full" />

              {/* Center circle/seal */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-green-600/20 rounded-full" />

              {/* Yellow/Gold band across middle */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-14 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 border-y-4 border-yellow-600 flex items-center justify-center">
                {/* Face on the band */}
                <div className="relative">
                  {/* Eyes */}
                  <div className="flex gap-3 mb-1.5">
                    {/* Left Eye */}
                    <motion.div
                      animate={{
                        scaleY: isBlinking && mood !== "sleeping" ? 0.1 : 1,
                      }}
                      transition={{ scaleY: { duration: 0.1 } }}
                    >
                      {mood === "sleeping" ? (
                        <div className="w-6 h-2 bg-gray-900 rounded-full" />
                      ) : (
                        <div className="relative w-6 h-7 bg-gray-900 rounded-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-white rounded-full absolute top-1.5 left-1.5" />
                          {mood === "concerned" && (
                            <motion.div
                              className="absolute -top-1.5 left-0 w-full h-1.5 bg-gray-900 rounded-sm"
                              style={{ transform: "rotate(-20deg)" }}
                            />
                          )}
                        </div>
                      )}
                    </motion.div>

                    {/* Right Eye */}
                    <motion.div
                      animate={{
                        scaleY: isBlinking && mood !== "sleeping" ? 0.1 : 1,
                      }}
                      transition={{ scaleY: { duration: 0.1 } }}
                    >
                      {mood === "sleeping" ? (
                        <div className="w-6 h-2 bg-gray-900 rounded-full" />
                      ) : (
                        <div className="relative w-6 h-7 bg-gray-900 rounded-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-white rounded-full absolute top-1.5 left-1.5" />
                          {mood === "concerned" && (
                            <motion.div
                              className="absolute -top-1.5 left-0 w-full h-1.5 bg-gray-900 rounded-sm"
                              style={{ transform: "rotate(20deg)" }}
                            />
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Mouth */}
                  {mood === "sleeping" ? (
                    <motion.div
                      className="w-7 h-2 bg-gray-900/60 rounded-full mt-1 mx-auto"
                      animate={{ scaleX: [1, 0.9, 1] }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ) : mood === "celebrating" || mood === "excited" ? (
                    <motion.div
                      className="w-10 h-6 bg-gray-900 rounded-b-full mt-1 mx-auto relative overflow-hidden"
                      animate={{
                        scaleY:
                          mood === "celebrating" ? [1, 1.15, 1] : [1, 1.08, 1],
                      }}
                      transition={{
                        duration: mood === "celebrating" ? 0.5 : 0.7,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-pink-400 rounded-full" />
                    </motion.div>
                  ) : mood === "concerned" ? (
                    <div
                      className="w-8 h-3.5 border-2.5 border-gray-900 rounded-t-full mt-1 mx-auto"
                      style={{ transform: "rotate(180deg)" }}
                    />
                  ) : (
                    <div className="w-9 h-5 bg-gray-900 rounded-b-full mt-1 mx-auto" />
                  )}
                </div>
              </div>
            </div>

            {/* Effects based on mood */}
            {mood === "sleeping" && (
              <>
                <motion.div
                  className="absolute -top-8 right-4 text-indigo-600 dark:text-indigo-300 font-bold text-2xl drop-shadow-lg"
                  animate={{ opacity: [0, 1, 1, 0], y: [0, -18] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                >
                  Z
                </motion.div>
                <motion.div
                  className="absolute -top-12 right-8 text-purple-600 dark:text-purple-300 font-bold text-lg drop-shadow-lg"
                  animate={{ opacity: [0, 1, 1, 0], y: [0, -22] }}
                  transition={{
                    duration: 2.3,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: 0.7,
                  }}
                >
                  z
                </motion.div>
                <motion.div
                  className="absolute -top-6 right-12 text-3xl drop-shadow-lg"
                  animate={{ rotate: [0, 10, 0], y: [-2, 2, -2] }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  🌙
                </motion.div>
              </>
            )}

            {mood === "celebrating" && (
              <>
                {/* Raining coins and money */}
                <motion.div
                  className="absolute -top-10 left-0 text-2xl drop-shadow-lg"
                  animate={{ y: [0, 40], rotate: [0, 360], opacity: [1, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  🪙
                </motion.div>
                <motion.div
                  className="absolute -top-8 left-8 text-xl drop-shadow-lg"
                  animate={{ y: [0, 45], rotate: [0, -360], opacity: [1, 0] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 0.2,
                  }}
                >
                  💰
                </motion.div>
                <motion.div
                  className="absolute -top-12 right-4 text-2xl drop-shadow-lg"
                  animate={{ y: [0, 50], rotate: [0, 360], opacity: [1, 0] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 0.4,
                  }}
                >
                  💵
                </motion.div>
                <motion.div
                  className="absolute -top-6 right-12 text-xl drop-shadow-lg"
                  animate={{ y: [0, 42], rotate: [0, -360], opacity: [1, 0] }}
                  transition={{
                    duration: 1.3,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 0.6,
                  }}
                >
                  🪙
                </motion.div>
                <motion.div
                  className="absolute -top-14 left-12 text-2xl drop-shadow-lg"
                  animate={{ y: [0, 48], rotate: [0, 360], opacity: [1, 0] }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    ease: "linear",
                    delay: 0.8,
                  }}
                >
                  💰
                </motion.div>
                {/* Confetti */}
                <motion.div
                  className="absolute -top-4 -left-6 text-2xl drop-shadow-lg"
                  animate={{
                    y: [0, -25, 0],
                    x: [-2, 2, -2],
                    opacity: [0, 1, 0],
                    rotate: [-10, 10, -10],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                >
                  🎉
                </motion.div>
                <motion.div
                  className="absolute top-2 -right-10 text-xl drop-shadow-lg"
                  animate={{
                    scale: [1, 1.4, 1],
                    rotate: [0, -360],
                    opacity: [0.6, 1, 0.6],
                    x: [0, 5, 0],
                  }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                >
                  💫
                </motion.div>
              </>
            )}

            {mood === "excited" && (
              <>
                {/* Floating coins with money symbols */}
                <motion.div
                  className="absolute -top-6 left-2 text-xl drop-shadow-lg"
                  animate={{
                    y: [-5, 5, -5],
                    rotate: [0, 360],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  🪙
                </motion.div>
                <motion.div
                  className="absolute top-4 -right-8 text-lg drop-shadow-lg"
                  animate={{
                    y: [5, -5, 5],
                    rotate: [0, -360],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 1.3, repeat: Infinity, delay: 0.3 }}
                >
                  💰
                </motion.div>
                <motion.div
                  className="absolute bottom-6 -left-6 text-lg drop-shadow-lg"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.3, 1],
                    x: [-3, 3, -3],
                  }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  💵
                </motion.div>
                <motion.div
                  className="absolute top-0 right-2 text-sm drop-shadow-lg"
                  animate={{ y: [-3, 3, -3], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.5 }}
                >
                  💡
                </motion.div>
              </>
            )}

            {mood === "concerned" && (
              <motion.div
                className="absolute -top-10 left-1/2 -translate-x-1/2 text-4xl"
                animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ⚠️
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
