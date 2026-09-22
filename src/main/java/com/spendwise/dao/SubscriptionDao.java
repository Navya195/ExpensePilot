package com.spendwise.dao;

import com.spendwise.model.Subscription;
import com.spendwise.util.DBConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class SubscriptionDao {

    public boolean addSubscription(Subscription s) {
        String sql = "INSERT INTO subscriptions (user_id, sub_name, amount, billing_cycle, next_billing_date) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, s.getUserId());
            ps.setString(2, s.getSubName());
            ps.setDouble(3, s.getAmount());
            ps.setString(4, s.getBillingCycle());
            ps.setDate(5, s.getNextBillingDate());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean deleteSubscription(int subId, int userId) {
        String sql = "DELETE FROM subscriptions WHERE sub_id=? AND user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, subId);
            ps.setInt(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public List<Subscription> getAllSubscriptions(int userId) {
        List<Subscription> list = new ArrayList<>();
        String sql = "SELECT * FROM subscriptions WHERE user_id=? ORDER BY next_billing_date ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Subscription s = new Subscription();
                    s.setSubId(rs.getInt("sub_id"));
                    s.setUserId(rs.getInt("user_id"));
                    s.setSubName(rs.getString("sub_name"));
                    s.setAmount(rs.getDouble("amount"));
                    s.setBillingCycle(rs.getString("billing_cycle"));
                    s.setNextBillingDate(rs.getDate("next_billing_date"));
                    list.add(s);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    // Total monthly subscription cost
    public double getTotalMonthlyCost(int userId) {
        double total = 0;
        List<Subscription> subs = getAllSubscriptions(userId);
        for (Subscription s : subs) {
            if ("monthly".equals(s.getBillingCycle())) {
                total += s.getAmount();
            } else if ("yearly".equals(s.getBillingCycle())) {
                total += s.getAmount() / 12.0;
            }
        }
        return total;
    }
}
