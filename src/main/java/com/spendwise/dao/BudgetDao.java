package com.spendwise.dao;

import com.spendwise.model.Budget;
import com.spendwise.util.DBConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class BudgetDao {

    public boolean addBudget(Budget b) {
        String sql = "INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, b.getUserId());
            ps.setString(2, b.getCategory());
            ps.setDouble(3, b.getMonthlyLimit());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean updateBudget(Budget b) {
        String sql = "UPDATE budgets SET category=?, monthly_limit=? WHERE budget_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, b.getCategory());
            ps.setDouble(2, b.getMonthlyLimit());
            ps.setInt(3, b.getBudgetId());
            ps.setInt(4, b.getUserId());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean deleteBudget(int budgetId, int userId) {
        String sql = "DELETE FROM budgets WHERE budget_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, budgetId);
            ps.setInt(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public List<Budget> getAllBudgets(int userId) {
        List<Budget> list = new ArrayList<>();
        String sql = "SELECT * FROM budgets WHERE user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Budget b = new Budget();
                    b.setBudgetId(rs.getInt("budget_id"));
                    b.setUserId(rs.getInt("user_id"));
                    b.setCategory(rs.getString("category"));
                    b.setMonthlyLimit(rs.getDouble("monthly_limit"));
                    list.add(b);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }
}
