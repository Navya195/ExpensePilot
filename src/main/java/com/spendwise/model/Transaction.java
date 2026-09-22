package com.spendwise.model;

import java.sql.Date;
import java.sql.Timestamp;

public class Transaction {
    private int transactionId;
    private int userId;
    private Integer accountId;
    private String type; // "income" or "expense"
    private double amount;
    private String category;
    private String merchantName;
    private Date date;
    private String description;
    private boolean isRecurring;
    private Timestamp createdAt;

    public Transaction() {}

    public int getTransactionId() { return transactionId; }
    public void setTransactionId(int transactionId) { this.transactionId = transactionId; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public Integer getAccountId() { return accountId; }
    public void setAccountId(Integer accountId) { this.accountId = accountId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Date getDate() { return date; }
    public void setDate(Date date) { this.date = date; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getMerchantName() { return merchantName; }
    public void setMerchantName(String merchantName) { this.merchantName = merchantName; }

    public boolean isRecurring() { return isRecurring; }
    public void setRecurring(boolean isRecurring) { this.isRecurring = isRecurring; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
