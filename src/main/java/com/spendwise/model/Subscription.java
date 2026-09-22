package com.spendwise.model;

import java.sql.Date;

public class Subscription {
    private int subId;
    private int userId;
    private String subName;
    private double amount;
    private String billingCycle; // "monthly" or "yearly"
    private Date nextBillingDate;

    public Subscription() {}

    public int getSubId() { return subId; }
    public void setSubId(int subId) { this.subId = subId; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public String getSubName() { return subName; }
    public void setSubName(String subName) { this.subName = subName; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getBillingCycle() { return billingCycle; }
    public void setBillingCycle(String billingCycle) { this.billingCycle = billingCycle; }

    public Date getNextBillingDate() { return nextBillingDate; }
    public void setNextBillingDate(Date nextBillingDate) { this.nextBillingDate = nextBillingDate; }
}
