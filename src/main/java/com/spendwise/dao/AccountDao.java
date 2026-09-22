package com.spendwise.dao;

import com.spendwise.model.Account;
import com.spendwise.util.DBConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class AccountDao {

    public boolean addAccount(Account a) {
        String sql = "INSERT INTO accounts (user_id, provider_name, account_type, balance, account_mask) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, a.getUserId());
            ps.setString(2, a.getProviderName());
            ps.setString(3, a.getAccountType());
            ps.setDouble(4, a.getBalance());
            ps.setString(5, a.getAccountMask());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public List<Account> getAccountsByUserId(int userId) {
        List<Account> list = new ArrayList<>();
        String sql = "SELECT * FROM accounts WHERE user_id=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Account a = new Account();
                    a.setAccountId(rs.getInt("account_id"));
                    a.setUserId(rs.getInt("user_id"));
                    a.setProviderName(rs.getString("provider_name"));
                    a.setAccountType(rs.getString("account_type"));
                    a.setBalance(rs.getDouble("balance"));
                    a.setAccountMask(rs.getString("account_mask"));
                    a.setStatus(rs.getString("status"));
                    a.setLastSynced(rs.getTimestamp("last_synced"));
                    list.add(a);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean checkIfAccountExists(int userId, String providerName) {
        String sql = "SELECT 1 FROM accounts WHERE user_id=? AND provider_name=?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setString(2, providerName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }
}
