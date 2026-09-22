const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'spendwise.db'));

try {
    // 1. Create Demo User
    const hashedPwd = bcrypt.hashSync('test123', 12);
    db.prepare('INSERT INTO users (name, email, password, phone_number, preferences) VALUES (?, ?, ?, ?, ?)').run(
        'Navya', 'test@test.com', hashedPwd, '+919876543210', '{"currency":"INR", "theme":"dark"}'
    );
    const userRow = db.prepare('SELECT user_id FROM users WHERE email = ?').get('test@test.com');
    const userId = userRow.user_id;

    // 2. Create Accounts
    db.prepare('INSERT INTO accounts (user_id, provider_name, account_type, status) VALUES (?, ?, ?, ?)').run(userId, 'HDFC Bank', 'Bank', 'Connected');
    db.prepare('INSERT INTO accounts (user_id, provider_name, account_type, status) VALUES (?, ?, ?, ?)').run(userId, 'ICICI Credit Card', 'Card', 'Connected');
    db.prepare('INSERT INTO accounts (user_id, provider_name, account_type, status) VALUES (?, ?, ?, ?)').run(userId, 'Paytm UPI', 'Wallet', 'Connected');
    const accounts = db.prepare('SELECT account_id, provider_name FROM accounts WHERE user_id = ?').all(userId);
    const hdfc = accounts.find(a => a.provider_name === 'HDFC Bank').account_id;
    const icici = accounts.find(a => a.provider_name === 'ICICI Credit Card').account_id;
    const paytm = accounts.find(a => a.provider_name === 'Paytm UPI').account_id;

    // 3. Create Merchants & Transactions
    const txInsert = db.prepare(`
        INSERT INTO transactions (user_id, account_id, type, amount, category, merchant_name, date, description, status, is_recurring) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const today = new Date();
    const isoDate = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
    };

    // Income
    txInsert.run(userId, hdfc, 'income', 85000, 'Salary', 'Employer Inc', isoDate(5), 'August Salary', 'completed', 1);
    
    // Expenses
    txInsert.run(userId, paytm, 'expense', 486, 'Food & Dining', 'Swiggy', isoDate(0), 'Lunch delivery', 'completed', 0);
    txInsert.run(userId, paytm, 'expense', 320, 'Transport', 'Uber', isoDate(1), 'Office commute', 'completed', 0);
    txInsert.run(userId, icici, 'expense', 2499, 'Shopping', 'Amazon', isoDate(2), 'Headphones', 'completed', 0);
    txInsert.run(userId, hdfc, 'expense', 22000, 'Housing', 'Rent', isoDate(4), 'September Rent', 'completed', 1);
    txInsert.run(userId, paytm, 'expense', 1850, 'Bills & Utilities', 'BESCOM Electricity', isoDate(3), 'Electricity bill', 'completed', 0);
    txInsert.run(userId, icici, 'expense', 649, 'Entertainment', 'Netflix', isoDate(10), 'Monthly Subscription', 'completed', 1);
    txInsert.run(userId, icici, 'expense', 119, 'Entertainment', 'Spotify', isoDate(12), 'Monthly Subscription', 'completed', 1);
    
    // Investment
    txInsert.run(userId, hdfc, 'investment', 10000, 'Investments', 'Zerodha SIP', isoDate(5), 'Mutual Fund SIP', 'completed', 1);

    // 4. Create Budgets
    const budgetInsert = db.prepare('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)');
    budgetInsert.run(userId, 'Food & Dining', 8000);
    budgetInsert.run(userId, 'Shopping', 5000);
    budgetInsert.run(userId, 'Transport', 4000);

    // 5. Create Goals
    const goalInsert = db.prepare('INSERT INTO goals (user_id, goal_name, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?, ?)');
    goalInsert.run(userId, 'Emergency Fund', 100000, 50000, '2027-12-31');
    goalInsert.run(userId, 'Vacation', 150000, 65000, '2027-06-01');
    goalInsert.run(userId, 'New Laptop', 80000, 40000, '2026-11-01');

    // 6. Create Subscriptions
    const subInsert = db.prepare('INSERT INTO subscriptions (user_id, sub_name, amount, billing_cycle, next_billing_date) VALUES (?, ?, ?, ?, ?)');
    subInsert.run(userId, 'Netflix', 649, 'monthly', isoDate(-20));
    subInsert.run(userId, 'Spotify', 119, 'monthly', isoDate(-18));
    subInsert.run(userId, 'Amazon Prime', 1499, 'yearly', '2027-02-15');
    
    // 7. Create Debts
    db.prepare('INSERT INTO debts (user_id, debt_name, debt_type, outstanding_balance, interest_rate, minimum_payment, next_payment_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        userId, 'Education Loan', 'loan', 450000, 8.5, 12500, isoDate(-5)
    );

    // 8. Create Net Worth
    db.prepare('INSERT INTO net_worth_history (user_id, total_assets, total_liabilities, net_worth, recorded_date) VALUES (?, ?, ?, ?, ?)').run(
        userId, 155000, 450000, -295000, isoDate(0)
    );

    // 9. Notifications
    db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)').run(userId, 'warning', 'Your dining expenses are 18% higher than your monthly target.');
    db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)').run(userId, 'success', 'You are on track to save ₹12,500 this month.');
    
    console.log('Successfully seeded database with realistic mock data.');
} catch (error) {
    console.error('Error seeding database:', error);
}
