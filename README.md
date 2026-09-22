# 💸 SpendWise 2.0 — Smart Personal Finance Command Center

SpendWise 2.0 is a premium, full-stack personal finance application. It has been completely re-architected into a fast, modern **Node.js, Express, and SQLite** backend, paired with a gorgeous, dark-themed frontend utilizing **Vanilla JS, CSS Grid/Flexbox**, and **Chart.js**.

---
SpendWise – Login Page

The SpendWise Login Page provides a clean, modern, and secure entry point for users to access their personal finance dashboard. The page uses a dark, professional financial theme with visually appealing lifestyle imagery representing common spending categories such as groceries, food, travel, shopping, and bills.

🔐 Key Features
Secure Login: Users can enter their registered email address and password to access their account.
Password Visibility: Users can easily show or hide their password while logging in.
Forgot Password: Provides an option to recover access to an account.
Create New Account: New users can navigate directly to the registration page.
Financial Branding: SpendWise branding and messaging clearly communicate the application's purpose.
Security Highlight: The page emphasizes privacy and bank-level security for user financial information.
Responsive Visual Design: Uses a full-screen layout with a dark theme, financial imagery, and clear call-to-action elements.
Spending Categories: Visual category indicators at the bottom represent areas such as Transport, Groceries, Food & Dining, Travel, Shopping, and Electricity Bills.

<img width="1907" height="962" alt="image" src="https://github.com/user-attachments/assets/b5281b55-042f-4b81-be7f-745af0aa7984" />


📊 SpendWise Dashboard

The SpendWise Dashboard acts as the central financial management interface where users can monitor their income, expenses, savings, spending capacity, and overall financial position from a single screen.

🏠 Dashboard Overview

The dashboard begins with a personalized greeting such as “Good afternoon” and provides a quick summary of the user's financial activity for the current month.

A search bar allows users to quickly find transactions, merchants, or categories, while the month selector allows them to change the reporting period.

💰 Safe to Spend Today

The Safe to Spend Today section provides an estimated amount the user can comfortably spend based on their:

Current budget
Spending patterns
Upcoming expenses

The On Track indicator gives users a quick visual indication of their current spending status.

📈 Money Snapshot

The Money Snapshot provides a compact overview of the user's financial position:

Income
Spent
Saved
Invested
Savings Rate

This allows users to understand their financial activity without navigating through multiple pages.

💳 Financial Summary Cards

The dashboard provides important financial metrics through individual cards:

Total Balance – Displays the user's current available balance.
Monthly Income – Shows income received during the selected month.
Monthly Expense – Displays total spending for the month.
Available to Spend – Indicates the amount currently available for spending.
Total Savings – Tracks accumulated savings.
Net Worth – Provides an overall view of the user's financial position.
🧠 Dashboard Insights

The Dashboard Insights section is designed to provide personalized financial information and help users understand their spending behavior.

The sidebar also provides access to advanced features such as:

📊 Analytics
🤖 AI Discovered Patterns
❤️ Smart Financial Health
🔮 Explore Your Financial Future
⏳ Financial Time Machine
💡 Best Time to Spend
📅 What Changed This Month?
➕ Transaction Management

The + Add Transaction button allows users to quickly record new financial activities, making it easier to keep their financial data updated.

🔔 Notifications

The notification icon provides access to important financial alerts and updates, helping users stay informed about their account activity.

🤖 Ask SpendWise

The Ask SpendWise assistant provides an interactive way for users to ask questions about their financial information and receive personalized insights from the application.

🧭 Navigation

The sidebar provides quick navigation to the main sections:

Dashboard → Transactions → Budgets → Savings Goals → Subscriptions → Analytics

It also provides access to the user's Profile and Logout options.

<img width="1907" height="932" alt="image" src="https://github.com/user-attachments/assets/c5530819-fa44-424f-b06c-c939e92ab342" />



## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript, Chart.js, FontAwesome |
| **Backend** | Node.js, Express.js |
| **Database** | SQLite3 (`better-sqlite3` for high performance) |
| **Authentication**| Sessions & bcrypt hashing |

---

## 📁 Project Structure

```text
SpendWise/
├── server.js                        ← Node.js/Express Backend & API Endpoints
├── spendwise.db                     ← SQLite Database File (auto-generated)
├── package.json                     ← Node Dependencies
├── seed.js                          ← Mock data seed script
└── src/
    └── main/
        └── webapp/                  ← Static Frontend Assets
            ├── login.html           
            ├── dashboard.html       
            ├── transactions.html    
            ├── connections.html     
            ├── budgets.html         
            ├── goals.html           
            ├── subscriptions.html   
            ├── analytics.html       
            ├── debt.html            
            ├── css/                 ← Custom Styling (dashboard.css, style.css)
            └── js/                  
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm (comes with Node.js)

### 2. Install Dependencies
Run this in the root directory of the project:
```bash
npm install express better-sqlite3 bcryptjs express-session
```

### 3. Start the Application
Simply run the server file. It will automatically initialize the database `spendwise.db` and serve the frontend:
```bash
node server.js
```

### 4. Access the App
Open your browser and navigate to:
```
http://localhost:8080/login.html
```

*(Note: If you run `node seed.js`, it will populate the database with mock Indian Rupees (₹) transactions, merchants, and goals for demonstration purposes).*

---
*Built with modern design principles and robust local-first data privacy.*


