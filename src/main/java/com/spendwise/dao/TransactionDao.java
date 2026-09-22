package com.spendwise.dao;

import com.spendwise.model.Transaction;
import com.spendwise.util.DBConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TransactionDao {

    public boolean addTransaction(Transaction t) {
        String sql = "INSERT INTO transactions (user_id, type, amount, category, date, description) VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, t.getUserId());
            ps.setString(2, t.getType());
            ps.setDouble(3, t.getAmount());
            ps.setString(4, t.getCategory());
            ps.setString(5, t.getDate() != null ? t.getDate().toString() : null);
            ps.setString(6, t.getDescription());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean updateTransaction(Transaction t) {
        String sql = "UPDATE transactions SET type=?, amount=?, category=?, date=?, description=? WHERE transaction_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, t.getType());
            ps.setDouble(2, t.getAmount());
            ps.setString(3, t.getCategory());
            ps.setString(4, t.getDate() != null ? t.getDate().toString() : null);
            ps.setString(5, t.getDescription());
            ps.setInt(6, t.getTransactionId());
            ps.setInt(7, t.getUserId());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean deleteTransaction(int transactionId, int userId) {
        String sql = "DELETE FROM transactions WHERE transaction_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, transactionId);
            ps.setInt(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public List<Transaction> getAllTransactions(int userId) {
        List<Transaction> list = new ArrayList<>();
        String sql = "SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Transaction> getRecentTransactions(int userId, int limit) {
        List<Transaction> list = new ArrayList<>();
        String sql = "SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, created_at DESC LIMIT ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Get total income for current month (SQLite compatible)
    public double getMonthlyIncome(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')";
        return getSum(sql, userId);
    }

    // Get total expense for current month (SQLite compatible)
    public double getMonthlyExpense(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')";
        return getSum(sql, userId);
    }

    // Get total income for previous month
    public double getPreviousMonthIncome(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income' AND strftime('%m', date)=strftime('%m', 'now', '-1 month') AND strftime('%Y', date)=strftime('%Y', 'now', '-1 month')";
        return getSum(sql, userId);
    }

    // Get total expense for previous month
    public double getPreviousMonthExpense(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now', '-1 month') AND strftime('%Y', date)=strftime('%Y', 'now', '-1 month')";
        return getSum(sql, userId);
    }

    // Get total income ever
    public double getTotalIncome(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income'";
        return getSum(sql, userId);
    }

    // Get total expense ever
    public double getTotalExpense(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense'";
        return getSum(sql, userId);
    }

    // Get daily expenses for heatmap (last 90 days) - SQLite compatible
    public Map<String, Double> getDailyExpenses(int userId) {
        Map<String, Double> map = new HashMap<>();
        String sql = "SELECT date, SUM(amount) as total FROM transactions WHERE user_id=? AND type='expense' AND date >= date('now', '-90 days') GROUP BY date";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("date"), rs.getDouble("total"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return map;
    }

    // Get monthly expense by category for current month - SQLite compatible
    public Map<String, Double> getCategoryExpenses(int userId) {
        Map<String, Double> map = new HashMap<>();
        String sql = "SELECT category, SUM(amount) as total FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now') GROUP BY category";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("category"), rs.getDouble("total"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return map;
    }

    // Get monthly income/expense totals for last 6 months (for bar chart) - SQLite compatible
    public List<Map<String, Object>> getMonthlyTrend(int userId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total "
                   + "FROM transactions WHERE user_id=? AND date >= date('now', '-6 months') "
                   + "GROUP BY strftime('%Y-%m', date), type ORDER BY month";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("month", rs.getString("month"));
                    row.put("type", rs.getString("type"));
                    row.put("total", rs.getDouble("total"));
                    list.add(row);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Get expense for a specific category this month (for budget tracking) - SQLite compatible
    public double getCategoryExpenseThisMonth(int userId, String category) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND category=? AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setString(2, category);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getDouble(1);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return 0;
    }

    // Weekly expense total - SQLite compatible
    public double getWeeklyExpense(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%Y-%W', date)=strftime('%Y-%W', 'now')";
        return getSum(sql, userId);
    }

    // Daily expense total - SQLite compatible
    public double getDailyExpense(int userId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND date=date('now')";
        return getSum(sql, userId);
    }

    private double getSum(String sql, int userId) {
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getDouble(1);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return 0;
    }

    private Transaction mapRow(ResultSet rs) throws SQLException {
        Transaction t = new Transaction();
        t.setTransactionId(rs.getInt("transaction_id"));
        t.setUserId(rs.getInt("user_id"));
        t.setType(rs.getString("type"));
        t.setAmount(rs.getDouble("amount"));
        t.setCategory(rs.getString("category"));
        String dateStr = rs.getString("date");
        if (dateStr != null && !dateStr.isEmpty()) {
            t.setDate(Date.valueOf(dateStr));
        }
        t.setDescription(rs.getString("description"));
        String createdAtStr = rs.getString("created_at");
        if (createdAtStr != null && !createdAtStr.isEmpty()) {
            try {
                t.setCreatedAt(Timestamp.valueOf(createdAtStr));
            } catch (Exception e) {
                // SQLite may store timestamps in various formats
            }
        }
        return t;
    }
}
