# 💸 SpendWise 2.0 — Smart Personal Finance Command Center

SpendWise 2.0 is a premium, full-stack personal finance application. It has been completely re-architected into a fast, modern **Node.js, Express, and SQLite** backend, paired with a gorgeous, dark-themed frontend utilizing **Vanilla JS, CSS Grid/Flexbox**, and **Chart.js**.

---

## ✨ Features

- **Automated Transaction Intelligence:** A custom deduplication engine, smart auto-categorization based on merchant keywords, and recurring bill detection.
- **Dynamic Dashboard:** A central command center featuring a "Safe to Spend" calculator, financial health score, and a 30-day cash flow forecast.
- **Connections & Data:** Manage all your linked bank accounts, wallets, and manual entries in one place.
- **Budgets & Goals:** Intuitive progress bars that change color based on spending velocity, plus visual savings trackers for long-term targets.
- **Analytics & Insights:** Fully interactive, animated Chart.js graphs tracking Income vs Expenses, Category Doughnuts, and Net Worth trends. Includes AI-driven actionable insights.
- **Debt Management:** A dedicated view for tracking mortgages, loans, and credit cards against your total assets.

---

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
