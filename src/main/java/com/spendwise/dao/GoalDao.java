package com.spendwise.dao;

import com.spendwise.model.Goal;
import com.spendwise.util.DBConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class GoalDao {

    public boolean addGoal(Goal g) {
        String sql = "INSERT INTO goals (user_id, goal_name, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, g.getUserId());
            ps.setString(2, g.getGoalName());
            ps.setDouble(3, g.getTargetAmount());
            ps.setDouble(4, g.getCurrentAmount());
            ps.setDate(5, g.getDeadline());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean updateGoal(Goal g) {
        String sql = "UPDATE goals SET goal_name=?, target_amount=?, current_amount=?, deadline=? WHERE goal_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, g.getGoalName());
            ps.setDouble(2, g.getTargetAmount());
            ps.setDouble(3, g.getCurrentAmount());
            ps.setDate(4, g.getDeadline());
            ps.setInt(5, g.getGoalId());
            ps.setInt(6, g.getUserId());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean addToGoal(int goalId, int userId, double amount) {
        String sql = "UPDATE goals SET current_amount = current_amount + ? WHERE goal_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDouble(1, amount);
            ps.setInt(2, goalId);
            ps.setInt(3, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean deleteGoal(int goalId, int userId) {
        String sql = "DELETE FROM goals WHERE goal_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, goalId);
            ps.setInt(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public List<Goal> getAllGoals(int userId) {
        List<Goal> list = new ArrayList<>();
        String sql = "SELECT * FROM goals WHERE user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Goal g = new Goal();
                    g.setGoalId(rs.getInt("goal_id"));
                    g.setUserId(rs.getInt("user_id"));
                    g.setGoalName(rs.getString("goal_name"));
                    g.setTargetAmount(rs.getDouble("target_amount"));
                    g.setCurrentAmount(rs.getDouble("current_amount"));
                    g.setDeadline(rs.getDate("deadline"));
                    list.add(g);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }
}
