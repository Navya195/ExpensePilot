package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.*;
import com.spendwise.model.*;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.util.*;

@WebServlet("/api/dashboard")
public class DashboardServlet extends HttpServlet {
    private TransactionDao txDao;
    private BudgetDao budgetDao;
    private GoalDao goalDao;
    private SubscriptionDao subDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        txDao = new TransactionDao();
        budgetDao = new BudgetDao();
        goalDao = new GoalDao();
        subDao = new SubscriptionDao();
        gson = new Gson();
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\": \"Not logged in\"}");
            return;
        }
        User user = (User) session.getAttribute("user");
        int userId = user.getUserId();

        Map<String, Object> dashboard = new HashMap<>();

        // Summary
        double totalIncome = txDao.getTotalIncome(userId);
        double totalExpense = txDao.getTotalExpense(userId);
        double monthlyIncome = txDao.getMonthlyIncome(userId);
        double monthlyExpense = txDao.getMonthlyExpense(userId);
        double weeklyExpense = txDao.getWeeklyExpense(userId);
        double dailyExpense = txDao.getDailyExpense(userId);
        double totalBalance = totalIncome - totalExpense;
        double totalSavings = totalBalance; // Simplified: savings = income - expense

        dashboard.put("totalBalance", totalBalance);
        dashboard.put("monthlyIncome", monthlyIncome);
        dashboard.put("monthlyExpense", monthlyExpense);
        dashboard.put("weeklyExpense", weeklyExpense);
        dashboard.put("dailyExpense", dailyExpense);
        dashboard.put("totalSavings", totalSavings);
        dashboard.put("userName", user.getName());
        
        // Previous month data for trends
        double prevMonthIncome = txDao.getPreviousMonthIncome(userId);
        double prevMonthExpense = txDao.getPreviousMonthExpense(userId);
        dashboard.put("prevMonthIncome", prevMonthIncome);
        dashboard.put("prevMonthExpense", prevMonthExpense);

        // Recent transactions (last 5)
        dashboard.put("recentTransactions", txDao.getRecentTransactions(userId, 5));

        // Monthly trend (for bar chart)
        dashboard.put("monthlyTrend", txDao.getMonthlyTrend(userId));

        // Category breakdown (for doughnut chart)
        dashboard.put("categoryExpenses", txDao.getCategoryExpenses(userId));

        // Daily expenses for heatmap
        dashboard.put("dailyExpenses", txDao.getDailyExpenses(userId));

        // SpendWise Financial Score (0-100)
        int score = calculateFinancialScore(userId, monthlyIncome, monthlyExpense, totalBalance);
        dashboard.put("spendwiseScore", score);

        // Additional data for premium dashboard components
        dashboard.put("budgets", budgetDao.getAllBudgets(userId));
        
        // Get goals and calculate their progress
        List<Goal> goals = goalDao.getAllGoals(userId);
        List<Map<String, Object>> goalMaps = new ArrayList<>();
        for (Goal g : goals) {
            Map<String, Object> map = new HashMap<>();
            map.put("goalName", g.getGoalName());
            map.put("currentAmount", g.getCurrentAmount());
            map.put("targetAmount", g.getTargetAmount());
            map.put("deadline", g.getDeadline() != null ? g.getDeadline().toString() : null);
            double progress = g.getTargetAmount() > 0 ? (g.getCurrentAmount() / g.getTargetAmount()) * 100 : 0;
            map.put("progress", Math.min(progress, 100));
            goalMaps.add(map);
        }
        dashboard.put("goals", goalMaps);

        List<Subscription> subs = subDao.getAllSubscriptions(userId);
        dashboard.put("subscriptions", subs);

        // 30-Day Cash Flow Forecast
        // Formula: Current Balance + (Monthly Income) - (Monthly Expenses/30 * 30) - (Monthly Subs)
        double monthlySubs = subDao.getTotalMonthlyCost(userId);
        double projectedBalance = totalBalance + monthlyIncome - monthlyExpense - monthlySubs;
        dashboard.put("cashFlowForecast", projectedBalance);

        // Smart Insights
        List<Map<String, String>> insights = generateInsights(userId, monthlyIncome, monthlyExpense, weeklyExpense, dailyExpense, totalBalance);
        dashboard.put("insights", insights);

        resp.getWriter().write(gson.toJson(dashboard));
    }

    /**
     * SpendWise Financial Score: A simple 0-100 score based on:
     * - Savings rate (40 points): How much of income is saved
     * - Budget adherence (30 points): How well budgets are followed
     * - Spending consistency (30 points): Is spending spread evenly or spiky
     */
    private int calculateFinancialScore(int userId, double monthlyIncome, double monthlyExpense, double totalBalance) {
        int score = 0;

        // 1. Savings rate score (0-40 pts)
        if (monthlyIncome > 0) {
            double savingsRate = (monthlyIncome - monthlyExpense) / monthlyIncome;
            if (savingsRate >= 0.30) score += 40;
            else if (savingsRate >= 0.20) score += 30;
            else if (savingsRate >= 0.10) score += 20;
            else if (savingsRate >= 0) score += 10;
            else score += 0; // Spending more than income
        } else {
            score += 5; // No income recorded yet, give minimal
        }

        // 2. Budget adherence (0-30 pts)
        List<Budget> budgets = budgetDao.getAllBudgets(userId);
        if (!budgets.isEmpty()) {
            int withinBudget = 0;
            for (Budget b : budgets) {
                double spent = txDao.getCategoryExpenseThisMonth(userId, b.getCategory());
                if (spent <= b.getMonthlyLimit()) withinBudget++;
            }
            double adherenceRate = (double) withinBudget / budgets.size();
            score += (int) (adherenceRate * 30);
        } else {
            score += 15; // No budgets set, neutral score
        }

        // 3. Positive balance bonus (0-30 pts)
        if (totalBalance > 0) {
            score += 20;
            if (monthlyIncome > 0 && monthlyExpense < monthlyIncome * 0.7) {
                score += 10;
            }
        } else if (totalBalance == 0) {
            score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * Smart Spending Insights using enhanced rules.
     */
    private List<Map<String, String>> generateInsights(int userId, double monthlyIncome, double monthlyExpense, double weeklyExpense, double dailyExpense, double totalBalance) {
        List<Map<String, String>> insights = new ArrayList<>();

        // Highest spending category insight
        Map<String, Double> categoryExpenses = txDao.getCategoryExpenses(userId);
        if (!categoryExpenses.isEmpty()) {
            String highestCat = "";
            double highestAmt = 0;
            for (Map.Entry<String, Double> entry : categoryExpenses.entrySet()) {
                if (entry.getValue() > highestAmt) {
                    highestAmt = entry.getValue();
                    highestCat = entry.getKey();
                }
            }
            if (highestAmt > 0) {
                addInsight(insights, "info", "🔍 " + highestCat + " is your highest spending category this month at $" + String.format("%.2f", highestAmt) + ".");
            }
        }

        // Insight 1: Savings rate
        if (monthlyIncome > 0) {
            double savingsRate = ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100;
            if (savingsRate >= 30) {
                addInsight(insights, "success", "🎉 Great job! You're saving " + String.format("%.0f", savingsRate) + "% of your income this month. Keep it up!");
            } else if (savingsRate >= 10) {
                addInsight(insights, "warning", "💡 You're saving " + String.format("%.0f", savingsRate) + "% of your income. Try to aim for 20-30% for better financial health.");
            } else if (savingsRate >= 0) {
                addInsight(insights, "danger", "⚠️ Your savings rate is only " + String.format("%.0f", savingsRate) + "%. Consider cutting non-essential expenses.");
            } else {
                addInsight(insights, "danger", "🚨 You're spending more than you earn this month! Review your expenses immediately.");
            }
        }

        // Insight 2: Budget warnings
        List<Budget> budgets = budgetDao.getAllBudgets(userId);
        for (Budget b : budgets) {
            double spent = txDao.getCategoryExpenseThisMonth(userId, b.getCategory());
            double pct = (spent / b.getMonthlyLimit()) * 100;
            if (pct >= 100) {
                addInsight(insights, "danger", "🔴 " + b.getCategory() + " budget exceeded! You've spent $" + String.format("%.2f", spent) + " of $" + String.format("%.2f", b.getMonthlyLimit()) + ".");
            } else if (pct >= 80) {
                addInsight(insights, "warning", "🟡 " + b.getCategory() + " is at " + String.format("%.0f", pct) + "% of budget. Be cautious with remaining spending.");
            }
        }

        // Insight 3: High daily spending check
        if (monthlyIncome > 0) {
            double avgDaily = monthlyIncome / 30;
            if (dailyExpense > avgDaily * 2) {
                addInsight(insights, "warning", "📊 Today's spending ($" + String.format("%.2f", dailyExpense) + ") is higher than your average daily income. Consider slowing down.");
            }
        }

        // Insight 4: Subscription cost
        double subCost = subDao.getTotalMonthlyCost(userId);
        if (subCost > 0 && monthlyIncome > 0) {
            double subPct = (subCost / monthlyIncome) * 100;
            if (subPct > 15) {
                addInsight(insights, "warning", "📺 Subscriptions cost $" + String.format("%.2f", subCost) + "/month (" + String.format("%.0f", subPct) + "% of income). Review if all are needed.");
            }
        }

        // Insight 5: General encouragement
        if (totalBalance > 0 && insights.isEmpty()) {
            addInsight(insights, "success", "✅ Your finances look healthy! Total balance: $" + String.format("%.2f", totalBalance) + ". Keep making smart decisions.");
        }

        if (insights.isEmpty()) {
            addInsight(insights, "success", "📝 Start adding transactions to see personalized insights about your spending habits!");
        }

        return insights;
    }

    private void addInsight(List<Map<String, String>> list, String type, String message) {
        Map<String, String> insight = new HashMap<>();
        insight.put("type", type);
        insight.put("message", message);
        list.add(insight);
    }
}
