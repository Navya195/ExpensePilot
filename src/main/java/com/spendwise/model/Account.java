package com.spendwise.model;

import java.sql.Timestamp;

public class Account {
    private int accountId;
    private int userId;
    private String providerName;
    private String accountType;
    private double balance;
    private String accountMask;
    private String status;
    private Timestamp lastSynced;

    // Getters and Setters
    public int getAccountId() {
        return accountId;
    }

    public void setAccountId(int accountId) {
        this.accountId = accountId;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public String getAccountType() {
        return accountType;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }

    public double getBalance() {
        return balance;
    }

    public void setBalance(double balance) {
        this.balance = balance;
    }

    public String getAccountMask() {
        return accountMask;
    }

    public void setAccountMask(String accountMask) {
        this.accountMask = accountMask;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Timestamp getLastSynced() {
        return lastSynced;
    }

    public void setLastSynced(Timestamp lastSynced) {
        this.lastSynced = lastSynced;
    }
}
