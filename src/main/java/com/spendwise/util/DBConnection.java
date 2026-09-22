package com.spendwise.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.SQLException;

public class DBConnection {
    // Will create a file named spendwise.db in the directory where Tomcat/the app runs
    private static final String DB_URL = "jdbc:sqlite:spendwise.db";

    static {
        try {
            // Load the SQLite JDBC driver
            Class.forName("org.sqlite.JDBC");
            initializeDatabase();
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to load SQLite JDBC driver.", e);
        }
    }

    private static void initializeDatabase() {
        // SQLite will automatically create spendwise.db if it doesn't exist
        try (Connection conn = DriverManager.getConnection(DB_URL);
             Statement stmt = conn.createStatement()) {
            
            // Execute each CREATE TABLE statement separately (SQLite doesn't support multiple statements in one call)
            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS users (" +
                "    user_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    name TEXT NOT NULL," +
                "    email TEXT UNIQUE NOT NULL," +
                "    password TEXT NOT NULL," +
                "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );

            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS accounts (" +
                "    account_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    user_id INTEGER NOT NULL," +
                "    provider_name TEXT NOT NULL," +
                "    account_type TEXT NOT NULL," +
                "    balance REAL DEFAULT 0," +
                "    account_mask TEXT," +
                "    status TEXT DEFAULT 'Connected'," +
                "    last_synced DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE" +
                ")"
            );

            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS transactions (" +
                "    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    user_id INTEGER NOT NULL," +
                "    type TEXT NOT NULL CHECK(type IN ('income', 'expense'))," +
                "    amount REAL NOT NULL," +
                "    category TEXT NOT NULL," +
                "    date DATE NOT NULL," +
                "    description TEXT," +
                "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE" +
                ")"
            );

            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS budgets (" +
                "    budget_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    user_id INTEGER NOT NULL," +
                "    category TEXT NOT NULL," +
                "    monthly_limit REAL NOT NULL," +
                "    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE" +
                ")"
            );

            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS goals (" +
                "    goal_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    user_id INTEGER NOT NULL," +
                "    goal_name TEXT NOT NULL," +
                "    target_amount REAL NOT NULL," +
                "    current_amount REAL DEFAULT 0.00," +
                "    deadline DATE," +
                "    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE" +
                ")"
            );

            stmt.executeUpdate(
                "CREATE TABLE IF NOT EXISTS subscriptions (" +
                "    sub_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "    user_id INTEGER NOT NULL," +
                "    sub_name TEXT NOT NULL," +
                "    amount REAL NOT NULL," +
                "    billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly'))," +
                "    next_billing_date DATE," +
                "    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE" +
                ")"
            );
            
            System.out.println("Database and tables initialized successfully using SQLite.");
            
        } catch (SQLException e) {
            System.err.println("Database initialization failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static Connection getConnection() throws SQLException {
        // Enforce foreign key constraints on every connection
        Connection conn = DriverManager.getConnection(DB_URL);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON;");
        }
        return conn;
    }
}
