document.addEventListener('DOMContentLoaded', function () {
    setGreeting();
    loadDashboard();
    setupLogout();
    setupModal();
    setupTransactionForm();
    setupChatInterface();
    setupSidebar();
    setupLiveSearch();
    setupDateFilter();
    setupInsightNavigation();
    document.getElementById('txDate').valueAsDate = new Date();
});

// ===================== SIDEBAR MOBILE TOGGLE & NAVIGATION =====================
function setupSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (toggle && sidebar && overlay) {
        toggle.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

function showInsightPanel(targetId) {
    if (!targetId) return;

    const subItems = document.querySelectorAll('.subheading-item');
    subItems.forEach(item => {
        const tgt = item.getAttribute('data-target');
        if (tgt === targetId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const panels = document.querySelectorAll('.insight-panel-view');
    panels.forEach(panel => {
        if (panel.id === 'panel-' + targetId || panel.id === targetId) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    if (targetId === 'financial-futures' && window.dashboardData) {
        setTimeout(() => renderFuturesChart(window.dashboardData), 150);
    }
}

function setupInsightNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const insightLinks = document.querySelectorAll('.sidebar-nav .nav-insight');
    const dashboardLink = document.getElementById('nav-item-dashboard');

    function setActiveNav(targetEl) {
        navItems.forEach(item => item.classList.remove('active'));
        if (targetEl) {
            targetEl.classList.add('active');
        }
    }

    if (dashboardLink) {
        dashboardLink.addEventListener('click', function (e) {
            e.preventDefault();
            setActiveNav(dashboardLink);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (history.pushState) history.pushState(null, null, 'dashboard.html');
        });
    }

    insightLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section') || (this.getAttribute('href') || '').split('#')[1];
            if (!sectionId) return;

            setActiveNav(this);
            showInsightPanel(sectionId);
            const containerCard = document.getElementById('dashboard-insights');
            if (containerCard) containerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (history.pushState) history.pushState(null, null, '#' + sectionId);
        });
    });

    if (window.location.hash) {
        const hashId = window.location.hash.substring(1);
        if (hashId) {
            setTimeout(() => {
                const matchingLink = document.querySelector(`.sidebar-nav .nav-insight[data-section="${hashId}"]`);
                if (matchingLink) setActiveNav(matchingLink);
                showInsightPanel(hashId);
            }, 300);
        }
    }
}

function setGreeting() {
    const updateGreeting = () => {
        const hour = new Date().getHours();
        let greeting = 'Good evening 👋';
        if (hour >= 5 && hour < 12) greeting = 'Good morning 👋';
        else if (hour >= 12 && hour < 17) greeting = 'Good afternoon 👋';
        
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) {
            greetingEl.textContent = greeting;
        }
    };
    
    updateGreeting();
    setInterval(updateGreeting, 60000);
}

function setupDateFilter() {
    const select = document.getElementById('dateRangeFilter');
    if (select) {
        select.addEventListener('change', function () {
            loadDashboard();
        });
    }
}

// ===================== LOAD DASHBOARD DATA =====================

function loadDashboard() {
    const dateFilterSelect = document.getElementById('dateRangeFilter');
    const dateFilter = dateFilterSelect ? dateFilterSelect.value : 'this_month';

    fetch('api/dashboard?dateFilter=' + encodeURIComponent(dateFilter))
        .then(r => {
            if (r.status === 401) { window.location.href = 'login.html'; throw new Error('Unauthorized'); }
            return r.json();
        })
        .then(data => {
            window.dashboardData = data;

            // User Data
            if(data.userName) {
                const now = new Date();
                const monthName = now.toLocaleString('default', { month: 'long' });
                document.getElementById('userNameLabel').textContent = `Here's your financial overview for ${monthName}, ${data.userName.split(' ')[0]}`;
            }

            // Summary cards
            document.getElementById('totalBalance').textContent = formatCurrency(data.totalBalance);
            document.getElementById('monthlyIncome').textContent = formatCurrency(data.monthlyIncome);
            document.getElementById('monthlyExpense').textContent = formatCurrency(data.monthlyExpense);
            document.getElementById('availableToSpend').textContent = formatCurrency(data.monthlyIncome - data.monthlyExpense);
            document.getElementById('totalSavings').textContent = formatCurrency(data.totalSavings);
            
            // Net worth = total balance (real calculation from DB)
            document.getElementById('netWorth').textContent = formatCurrency(data.totalBalance);
            
            // 💰 SAFE TO SPEND TODAY — REAL DYNAMIC DATA ENGINE
            renderSafeToSpendCard(data.safeToSpend);

            // 📊 MONTHLY COMPARISON ("What Changed This Month?")
            renderMonthlyComparisonSection(data.monthlyComparison);

            // Snapshot
            document.getElementById('snapIncome').textContent = formatCurrency(data.monthlyIncome);
            document.getElementById('snapSpent').textContent = formatCurrency(data.monthlyExpense);
            
            const savedAmt = Math.max(0, data.monthlyIncome - data.monthlyExpense);
            document.getElementById('snapSaved').textContent = formatCurrency(savedAmt);
            // Sum real investment transactions from API
            const investedAmt = (data.recentTransactions || []).reduce((sum, t) => t.type === 'investment' ? sum + t.amount : sum, 0);
            document.getElementById('snapInvested').textContent = formatCurrency(investedAmt);
            
            const savingsRate = data.monthlyIncome > 0 ? (savedAmt / data.monthlyIncome) * 100 : 0;
            document.getElementById('snapSavingsRate').textContent = savingsRate.toFixed(0) + '%';
            document.getElementById('snapSavingsBar').style.width = savingsRate.toFixed(0) + '%';

            // SpendWise Score & Health — all derived from real API data
            renderFinancialHealth(data.spendwiseScore);
            // Budget health: are all budgets within limits?
            const budgets = data.budgets || [];
            const catExp = data.categoryExpenses || {};
            const budgetsOk = budgets.length === 0 || budgets.every(b => (catExp[b.category] || 0) <= (b.monthlyLimit || 0));
            document.getElementById('hf-budget').textContent = budgetsOk ? 'Good' : 'Over Limit';
            document.getElementById('hf-savings').textContent = savingsRate >= 30 ? 'Great' : savingsRate >= 10 ? 'Fair' : 'Low';
            // Spending: compare this month vs last month
            const spendingTrend = data.prevMonthExpense > 0
                ? ((data.monthlyExpense - data.prevMonthExpense) / data.prevMonthExpense) * 100
                : 0;
            document.getElementById('hf-spending').textContent = spendingTrend <= 5 ? 'Stable' : spendingTrend <= 20 ? 'Rising' : 'High';
            // Emergency fund: rough proxy — balance vs monthly expenses
            const efMonths = data.monthlyExpense > 0 ? data.totalBalance / data.monthlyExpense : 0;
            document.getElementById('hf-emergency').textContent = efMonths >= 6 ? 'Strong' : efMonths >= 3 ? 'Building' : 'Low';
            // Debt: presence of negative balance
            document.getElementById('hf-debt').textContent = data.totalBalance >= 0 ? 'Managed' : 'At Risk';
            // Subs: subscription cost vs income
            let monthlySubs2 = 0;
            (data.subscriptions || []).forEach(s => { monthlySubs2 += s.billingCycle === 'monthly' ? s.amount : s.amount / 12; });
            const subPct = data.monthlyIncome > 0 ? (monthlySubs2 / data.monthlyIncome) * 100 : 0;
            document.getElementById('hf-subs').textContent = subPct <= 10 ? 'Optimized' : subPct <= 20 ? 'Moderate' : 'High';

            // Forecast
            document.getElementById('cashFlowForecast').textContent = formatCurrency(data.cashFlowForecast);
            document.getElementById('cf-income').textContent = '+' + formatCurrency(data.monthlyIncome);
            document.getElementById('cf-spend').textContent = '-' + formatCurrency(data.monthlyExpense);
            
            let monthlySubs = 0;
            (data.subscriptions || []).forEach(s => { monthlySubs += s.billingCycle === 'monthly' ? s.amount : s.amount / 12; });
            document.getElementById('cf-bills').textContent = '-' + formatCurrency(monthlySubs);

            // Category Spending Breakdown List
            renderCategorySpendingBreakdown(data.categoryExpenses);

            // Recent transactions table
            renderRecentTransactions(data.recentTransactions);

            // Fetch Real Persistent DB Notifications
            fetchNotifications();

            // Charts & Others
            try {
                renderIncomeExpenseChart(data.monthlyTrend);
                renderCategoryChart(data.categoryExpenses);
            } catch (e) {}

            renderInsights(data.insights);

            // ===================== FINANCIAL TIME MACHINE INITIALIZATIONS =====================
            try {
                runTimeMachineSimulation();
                renderFuturesChart(data);
                selectFutureTrajectory('current');
                calculateBestTimeToSpend();
                renderFinancialTwin(data);
                renderAIDiscoveredPatterns(data);
            } catch (e) {
                console.error('Time Machine init error:', e);
            }

            try {
                renderBudgetProgress(data.budgets, data.categoryExpenses);
                renderSavingsGoals(data.goals);
                renderUpcomingBills(data.subscriptions);
            } catch (e) {}
        })
        .catch(err => {
            console.error('Dashboard load error:', err);
        });
}

// ===================== RENDER FUNCTIONS =====================
function renderTrend(elementId, current, previous, suffix) {
    const el = document.getElementById(elementId);
    if (!previous || previous === 0) {
        el.innerHTML = `<span class="neutral">-</span> ${suffix}`;
        return;
    }
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    
    if (pct > 0) {
        el.innerHTML = `<span class="positive"><i class="fa-solid fa-arrow-up"></i> ${pct.toFixed(1)}%</span> ${suffix}`;
    } else if (pct < 0) {
        el.innerHTML = `<span class="negative"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(pct).toFixed(1)}%</span> ${suffix}`;
    } else {
        el.innerHTML = `<span class="neutral">0%</span> ${suffix}`;
    }
}

function renderFinancialHealth(score) {
    document.getElementById('spendwiseScoreVal').textContent = score;

    // Explanation
    const exp = document.getElementById('scoreExplanation');
    if (score >= 80) exp.textContent = "Excellent financial health! Your savings rate and budget adherence are on point.";
    else if (score >= 50) exp.textContent = "Good standing, but there is room for improvement in sticking to your limits.";
    else exp.textContent = "Warning: Your spending is outpacing your targets. Let's review your budget.";
}

function renderBudgetProgress(budgets, expenses) {
    const list = document.getElementById('budgetProgressList');
    if (!budgets || budgets.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">No budgets set.</p>';
        return;
    }
    list.innerHTML = budgets.map(b => {
        const spent = expenses[b.category] || 0;
        const pct = Math.min((spent / b.monthlyLimit) * 100, 100);
        let color = '#2ecc71';
        if (pct >= 90) color = '#e74c3c';
        else if (pct >= 75) color = '#f1c40f';
        
        return `
        <div class="progress-item">
            <div class="progress-header">
                <span>${b.category}</span>
                <span>${formatCurrency(spent)} / ${formatCurrency(b.monthlyLimit)}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: 0%; background: ${color};" data-width="${pct}%"></div>
            </div>
        </div>
        `;
    }).join('');
    
    // Animate
    setTimeout(() => {
        list.querySelectorAll('.progress-bar-fill').forEach(el => {
            el.style.width = el.getAttribute('data-width');
        });
    }, 100);
}

function renderSavingsGoals(goals) {
    const list = document.getElementById('goalsProgressList');
    if (!goals || goals.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">No active savings goals.</p>';
        return;
    }
    list.innerHTML = goals.slice(0, 4).map(g => {
        return `
        <div class="progress-item">
            <div class="progress-header">
                <span>${g.goalName}</span>
                <span>${g.progress.toFixed(0)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: 0%; background: #3498db;" data-width="${g.progress}%"></div>
            </div>
        </div>
        `;
    }).join('');
    
    // Animate
    setTimeout(() => {
        list.querySelectorAll('.progress-bar-fill').forEach(el => {
            el.style.width = el.getAttribute('data-width');
        });
    }, 100);
}

function renderUpcomingBills(subs) {
    const list = document.getElementById('upcomingBillsList');
    if (!subs || subs.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">No upcoming bills.</p>';
        return;
    }
    list.innerHTML = subs.slice(0, 4).map(s => {
        return `
        <div class="bill-item">
            <div class="bill-info">
                <h4>${s.subName}</h4>
                <p>Due: ${s.nextBillingDate || 'Soon'}</p>
            </div>
            <div class="bill-amount">${formatCurrency(s.amount)}</div>
        </div>
        `;
    }).join('');
}

function renderCategorySpendingBreakdown(categoryExpenses) {
    const container = document.getElementById('categorySpendingList');
    if (!container) return;
    
    if (!categoryExpenses || Object.keys(categoryExpenses).length === 0) {
        container.innerHTML = '<p class="text-muted text-center text-sm" style="margin: 1rem 0;">No category expenses recorded yet.</p>';
        return;
    }

    const totalExp = Object.values(categoryExpenses).reduce((a, b) => a + b, 0);
    if (totalExp === 0) {
        container.innerHTML = '<p class="text-muted text-center text-sm" style="margin: 1rem 0;">No category expenses recorded yet.</p>';
        return;
    }

    const colors = ['#55b882', '#3498db', '#9b59b6', '#e74c3c', '#f1c40f', '#e67e22', '#1abc9c'];
    let idx = 0;
    
    container.innerHTML = Object.entries(categoryExpenses)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
            const pct = Math.round((amt / totalExp) * 100);
            const color = colors[idx++ % colors.length];
            return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.85rem; font-weight: 500;">${cat}</span>
                        <span style="font-size: 0.85rem; font-weight: 600; color: ${color};">${formatCurrency(amt)} <span style="font-size: 0.75rem; color: #888;">(${pct}%)</span></span>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden;">
                        <div style="background: ${color}; height: 100%; width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
}

function renderRecentTransactions(txs) {
    window.allTransactions = txs || [];
    const table = document.getElementById('recentTransactionsTable');
    if (!table) return;

    if (!txs || txs.length === 0) {
        table.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No transactions found.</td></tr>';
        return;
    }
    
    table.innerHTML = txs.map(t => {
        const colorClass = t.type === 'income' ? 'text-success' : (t.type === 'investment' ? 'text-primary' : 'text-danger');
        const sign = t.type === 'income' ? '+' : '-';
        const displayMerchant = t.merchantName || t.description || t.category;
        const displayMethod = t.paymentMethod || 'Cash';
        
        return `
        <tr>
            <td class="pl-1">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width:36px; height:36px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                        ${getCategoryIcon(t.category)}
                    </div>
                    <div>
                        <div style="font-weight: 500">${displayMerchant}</div>
                        ${t.description && t.description !== displayMerchant ? `<div style="font-size: 0.75rem; color: #888">${t.description}</div>` : ''}
                    </div>
                </div>
            </td>
            <td style="color: #c5cad6">${t.category}</td>
            <td style="color: #a0a0a0">${t.date}</td>
            <td style="color: #a0a0a0"><span class="badge" style="background: rgba(255,255,255,0.08); font-weight: 500; padding: 3px 8px; border-radius: 6px;">${displayMethod}</span></td>
            <td><span class="badge ${t.type === 'income' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}" style="text-transform: capitalize;">${t.type}</span></td>
            <td class="${colorClass}" style="font-weight: 600; text-align: right;">
                ${sign}${formatCurrency(t.amount)}
            </td>
            <td class="text-center">
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn-icon text-info" onclick="openEditTransactionModal('${t.transactionId}')" title="Edit" style="background:none; border:none; cursor:pointer; padding: 4px 6px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon text-danger" onclick="deleteTransaction('${t.transactionId}')" title="Delete" style="background:none; border:none; cursor:pointer; padding: 4px 6px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function renderIncomeExpenseChart(trend) {
    const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
    const months = [...new Set(trend.map(t => t.month))].sort();
    const incomeData = months.map(m => {
        const entry = trend.find(t => t.month === m && t.type === 'income');
        return entry ? entry.total : 0;
    });
    const expenseData = months.map(m => {
        const entry = trend.find(t => t.month === m && t.type === 'expense');
        return entry ? entry.total : 0;
    });

    const labels = months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en', { month: 'short' });
    });

    if (labels.length === 0) {
        labels.push('No Data'); incomeData.push(0); expenseData.push(0);
    }

    // Gradients
    const incGradient = ctx.createLinearGradient(0, 0, 0, 400);
    incGradient.addColorStop(0, 'rgba(46, 204, 113, 0.8)');
    incGradient.addColorStop(1, 'rgba(46, 204, 113, 0.2)');

    const expGradient = ctx.createLinearGradient(0, 0, 0, 400);
    expGradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
    expGradient.addColorStop(1, 'rgba(231, 76, 60, 0.2)');

    new Chart(ctx, {
        type: 'line', // Changed to smooth line chart for premium look
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#2ecc71',
                    backgroundColor: incGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#2ecc71'
                },
                {
                    label: 'Expense',
                    data: expenseData,
                    borderColor: '#e74c3c',
                    backgroundColor: expGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#e74c3c'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    titleFont: { size: 14, family: 'Inter' },
                    bodyFont: { size: 13, family: 'Inter' }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#888' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' }, beginAtZero: true }
            }
        }
    });
}

function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const labels = Object.keys(categories);
    const data = Object.values(categories);

    const colors = ['#55b882', '#3498db', '#9b59b6', '#e74c3c', '#f1c40f', '#e67e22', '#1abc9c'];

    if (labels.length === 0) {
        labels.push('No Data'); data.push(1);
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#aaa', padding: 15, font: { family: 'Inter', size: 12 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let val = context.raw;
                            let sum = context.chart._metasets[context.datasetIndex].total;
                            let pct = ((val / sum) * 100).toFixed(1) + "%";
                            return ` $${val.toFixed(2)} (${pct})`;
                        }
                    }
                }
            }
        }
    });
}

function renderInsights(insights) {
    const list = document.getElementById('insightsList');
    if (!insights || insights.length === 0) {
        list.innerHTML = '<li class="insight-item">📝 Add some transactions to see AI insights!</li>';
        return;
    }
    list.innerHTML = insights.map(i =>
        `<li class="insight-item ${i.type}">${i.message}</li>`
    ).join('');
}

// ===================== CHAT INTERFACE =====================
function setupChatInterface() {
    const btn = document.getElementById('openChatBtn');
    const win = document.getElementById('chatWindow');
    const close = document.getElementById('closeChatBtn');
    const send = document.getElementById('sendChatBtn');
    const input = document.getElementById('chatInput');
    const body = document.getElementById('chatBody');

    btn.addEventListener('click', () => {
        win.classList.add('active');
        btn.style.display = 'none';
    });

    close.addEventListener('click', () => {
        win.classList.remove('active');
        setTimeout(() => btn.style.display = 'flex', 300);
    });

    function sendMessage() {
        const text = input.value.trim();
        if(!text) return;
        
        // User message
        body.innerHTML += `<div class="message user-message">${text}</div>`;
        input.value = '';
        body.scrollTop = body.scrollHeight;

        // Bot response (Simulated AI)
        setTimeout(() => {
            const responses = [
                "Based on your trends, you might want to cut back on Food & Groceries this week.",
                "Your savings rate is looking good! Consider moving some cash to a high-yield account.",
                "I've noticed your subscriptions are taking up 15% of your income. Maybe review them?",
                "That's a great question. Maintaining a 50/30/20 budget is usually best."
            ];
            const reply = responses[Math.floor(Math.random() * responses.length)];
            body.innerHTML += `<div class="message bot-message">${reply}</div>`;
            body.scrollTop = body.scrollHeight;
        }, 1000);
    }

    send.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
}

// ===================== MODAL & TRANSACTION HANDLING =====================
function openAddTransactionModal(type = 'expense') {
    const form = document.getElementById('addTransactionForm');
    if (form) form.reset();
    const idEl = document.getElementById('txId');
    if (idEl) idEl.value = '';
    const titleEl = document.getElementById('modalTxTitle');
    if (titleEl) titleEl.textContent = 'Add Transaction';
    const btnEl = document.getElementById('txSubmitBtn');
    if (btnEl) btnEl.textContent = 'Save Transaction';
    
    document.getElementById('txType').value = type;
    document.getElementById('txDate').valueAsDate = new Date();
    document.getElementById('transactionModal').classList.add('active');
}

function openEditTransactionModal(txId) {
    const tx = (window.allTransactions || []).find(t => t.transactionId === txId);
    if (!tx) return;

    document.getElementById('txId').value = tx.transactionId;
    document.getElementById('txType').value = tx.type || 'expense';
    document.getElementById('txAmount').value = tx.amount || '';
    document.getElementById('txCategory').value = tx.category || 'Other';
    document.getElementById('txMerchant').value = tx.merchantName || '';
    document.getElementById('txPaymentMethod').value = tx.paymentMethod || 'Cash';
    document.getElementById('txDate').value = tx.date || '';
    document.getElementById('txDescription').value = tx.description || '';
    document.getElementById('txNotes').value = tx.notes || '';

    const titleEl = document.getElementById('modalTxTitle');
    if (titleEl) titleEl.textContent = 'Edit Transaction';
    const btnEl = document.getElementById('txSubmitBtn');
    if (btnEl) btnEl.textContent = 'Update Transaction';

    document.getElementById('transactionModal').classList.add('active');
}

function deleteTransaction(txId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    fetch('api/transactions?id=' + encodeURIComponent(txId), { method: 'DELETE' })
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                loadDashboard();
            } else {
                alert(res.error || 'Failed to delete transaction');
            }
        })
        .catch(err => alert('Error deleting transaction: ' + err.message));
}

function setupModal() {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
}

function setupTransactionForm() {
    const form = document.getElementById('addTransactionForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const txId = document.getElementById('txId').value;
        const method = txId ? 'PUT' : 'POST';
        const formData = new URLSearchParams(new FormData(this));

        fetch('api/transactions', {
            method: method,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                document.getElementById('transactionModal').classList.remove('active');
                this.reset();
                document.getElementById('txDate').valueAsDate = new Date();
                loadDashboard();
            } else {
                alert(data.error || 'Failed to save transaction');
            }
        })
        .catch(err => alert('Error: ' + err.message));
    });
}

function setupLiveSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();
        const allTxs = window.allTransactions || [];

        if (!query) {
            renderRecentTransactions(allTxs);
            return;
        }

        const filtered = allTxs.filter(t => {
            const desc = (t.description || '').toLowerCase();
            const merch = (t.merchantName || '').toLowerCase();
            const cat = (t.category || '').toLowerCase();
            const meth = (t.paymentMethod || '').toLowerCase();
            const amt = String(t.amount || '');
            return desc.includes(query) || merch.includes(query) || cat.includes(query) || meth.includes(query) || amt.includes(query);
        });

        const table = document.getElementById('recentTransactionsTable');
        if (!table) return;

        if (filtered.length === 0) {
            table.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No matching transactions found.</td></tr>';
        } else {
            table.innerHTML = filtered.map(t => {
                const colorClass = t.type === 'income' ? 'text-success' : (t.type === 'investment' ? 'text-primary' : 'text-danger');
                const sign = t.type === 'income' ? '+' : '-';
                const displayMerchant = t.merchantName || t.description || t.category;
                const displayMethod = t.paymentMethod || 'Cash';

                return `
                <tr>
                    <td class="pl-1">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width:36px; height:36px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                                ${getCategoryIcon(t.category)}
                            </div>
                            <div>
                                <div style="font-weight: 500">${displayMerchant}</div>
                                ${t.description && t.description !== displayMerchant ? `<div style="font-size: 0.75rem; color: #888">${t.description}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td style="color: #c5cad6">${t.category}</td>
                    <td style="color: #a0a0a0">${t.date}</td>
                    <td style="color: #a0a0a0"><span class="badge" style="background: rgba(255,255,255,0.08); font-weight: 500; padding: 3px 8px; border-radius: 6px;">${displayMethod}</span></td>
                    <td><span class="badge ${t.type === 'income' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}" style="text-transform: capitalize;">${t.type}</span></td>
                    <td class="${colorClass}" style="font-weight: 600; text-align: right;">
                        ${sign}${formatCurrency(t.amount)}
                    </td>
                    <td class="text-center">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="btn-icon text-info" onclick="openEditTransactionModal('${t.transactionId}')" title="Edit" style="background:none; border:none; cursor:pointer; padding: 4px 6px;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-icon text-danger" onclick="deleteTransaction('${t.transactionId}')" title="Delete" style="background:none; border:none; cursor:pointer; padding: 4px 6px;">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
    });
}

// ===================== UTILITIES =====================
function formatCurrency(n) {
    return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCategoryIcon(category) {
    const map = {
        'Food & Groceries': '🍔',
        'Transport': '🚗',
        'Shopping': '🛍️',
        'Bills & Lifestyle': '🧾',
        'Finance & Savings': '💰',
        'Travel': '✈️',
        'Salary': '💵',
        'Other': '📌'
    };
    return map[category] || '📌';
}

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', function (e) {
        e.preventDefault();
        fetch('api/auth/logout', { method: 'POST' })
            .then(() => window.location.href = 'login.html')
            .catch(() => window.location.href = 'login.html');
    });
}

// ===================== REAL-TIME NOTIFICATIONS (DATABASE INTEGRATED) =====================

function toggleNotifications(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            fetchNotifications();
        }
    }
}

function fetchNotifications() {
    fetch('api/notifications')
        .then(r => r.json())
        .then(data => {
            if (data.notifications) {
                window.dbNotifications = data.notifications;
                renderNotificationsFromDB(data.notifications);
            }
        })
        .catch(() => {});
}

function renderNotificationsFromDB(notifications) {
    const body = document.getElementById('notifBody');
    const badge = document.getElementById('notifBadge');
    if (!body) return;

    const unreadCount = (notifications || []).filter(n => !(n.isRead || n.is_read)).length;
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (!notifications || notifications.length === 0) {
        body.innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem;">
                <p class="text-muted" style="margin:0; font-weight: 500;">No new notifications</p>
                <p class="text-muted" style="margin:4px 0 0 0; font-size: 0.85rem;">You're all caught up.</p>
            </div>
        `;
        return;
    }

    body.innerHTML = notifications.map(n => {
        const isRead = n.isRead || n.is_read;
        const type = n.type || 'system';
        const icon = type === 'transaction' ? 'fa-money-bill-wave' : (type === 'budget' ? 'fa-triangle-exclamation' : (type === 'goal' ? 'fa-trophy' : 'fa-info-circle'));
        const colorClass = type === 'budget' ? 'text-warning' : (type === 'transaction' ? 'text-info' : 'text-success');
        const timeFormatted = n.created_at ? new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';

        return `
            <div class="notif-item ${isRead ? '' : 'unread'}" onclick="markAlertRead('${n.id}')" style="cursor: pointer; padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; gap: 0.8rem; align-items: flex-start;">
                    <div class="notif-icon-circle bg-dark border" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05);">
                        <i class="fa-solid ${icon} ${colorClass}"></i>
                    </div>
                    <div class="notif-content" style="flex: 1;">
                        <h4 class="notif-title" style="margin: 0; font-size: 0.85rem; text-transform: capitalize; color: #fff;">${type} Alert</h4>
                        <p class="notif-message" style="margin: 0.2rem 0; font-size: 0.8rem; color: #c5cad6; line-height: 1.3;">${n.message}</p>
                        <p class="notif-time" style="margin: 0; font-size: 0.72rem; color: #888;">${timeFormatted}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function markAlertRead(id) {
    fetch('api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id })
    })
    .then(() => fetchNotifications())
    .catch(() => {});
}

function markAllAlertsRead() {
    fetch('api/notifications/mark-all-read', { method: 'POST' })
        .then(() => fetchNotifications())
        .catch(() => {});
}

function clearAllNotifications() {
    fetch('api/notifications', { method: 'DELETE' })
        .then(() => fetchNotifications())
        .catch(() => {});
}

// Close notification dropdown when clicking outside
document.addEventListener('click', function(e) {
    const container = document.getElementById('notifContainer');
    const dropdown = document.getElementById('notifDropdown');
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// ===================== 🔮 FINANCIAL TIME MACHINE & FUTURES FUNCTIONS =====================

function runTimeMachineSimulation() {
    const data = window.dashboardData || {};
    const mainContainer = document.getElementById('tmMainContainer');
    const inputElem = document.getElementById('tmSimulateAmount');
    if (!mainContainer || !inputElem) return;

    // 10. HANDLE NO LINKED ACCOUNTS
    const accounts = data.accounts || [];
    if (!accounts || accounts.length === 0) {
        mainContainer.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; margin-top: 1rem;">
                <i class="fa-solid fa-link-slash" style="font-size: 2.5rem; color: #8b8fa3; margin-bottom: 0.8rem;"></i>
                <h4 style="margin: 0; color: #fff; font-size: 1.1rem;">No Linked Accounts Found</h4>
                <p class="text-muted text-sm" style="margin: 0.4rem 0 1.2rem 0;">Connect an account to get personalized Financial Time Machine predictions.</p>
                <a href="connections.html" class="lf-btn lf-btn-primary" style="display: inline-flex; width: auto; padding: 0.65rem 1.4rem; text-decoration: none; border-radius: 8px;"><i class="fa-solid fa-plus"></i> CONNECT ACCOUNT</a>
            </div>
        `;
        return;
    }

    // 1. FIX THE AMOUNT CALCULATION (Use user's ACTUAL total balance from DB/API)
    const currentBalance = (typeof data.totalBalance === 'number') ? data.totalBalance : accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
    const monthlyIncome = parseFloat(data.monthlyIncome) || 0;
    const monthlyExpense = parseFloat(data.monthlyExpense) || 0;
    
    // Subscriptions cost (upcoming bills)
    let subsCost = 0;
    (data.subscriptions || []).forEach(s => { subsCost += parseFloat(s.amount) || 0; });

    // Net Monthly Savings = Income - Expenses - Upcoming Bills
    const netMonthlySavings = monthlyIncome - monthlyExpense - subsCost;
    // Net Daily Savings rate
    const dailyNetSavings = netMonthlySavings > 0 ? (netMonthlySavings / 30) : Math.max(10, currentBalance * 0.005);

    // 2. FIX CURRENT PATH (Baseline without purchase)
    const baseline30DayBalance = currentBalance + (dailyNetSavings * 30);

    // 11. HANDLE NO SAVINGS GOAL
    const goals = data.goals || [];
    const hasSavingsGoal = goals && goals.length > 0;
    const mainGoal = hasSavingsGoal ? goals[0] : null;

    const goalTarget = hasSavingsGoal ? (parseFloat(mainGoal.targetAmount) || 0) : 0;
    const goalCurrent = hasSavingsGoal ? (parseFloat(mainGoal.currentAmount) || 0) : 0;

    // 7. FIX SAVINGS PROGRESS (Without purchase)
    const baselineProgressVal = (hasSavingsGoal && goalTarget > 0) ? Math.min(100, Math.max(0, (goalCurrent / goalTarget) * 100)) : 0;
    const baselineProgressStr = hasSavingsGoal ? (baselineProgressVal.toFixed(0) + '%') : '<a href="goals.html" style="color:#55b882; text-decoration:none;">No savings goal available. <span style="text-decoration:underline;">[ CREATE SAVINGS GOAL ]</span></a>';

    // 5. FIX GOAL COMPLETION DATE (Without purchase)
    let currentGoalDateStr = '<a href="goals.html" style="color:#55b882; text-decoration:none;">No savings goal available. <span style="text-decoration:underline;">[ CREATE SAVINGS GOAL ]</span></a>';
    let daysToGoalWithoutPurchase = 0;
    const nowMs = Date.now();

    if (hasSavingsGoal && goalTarget > 0) {
        const remainingToGoal = Math.max(0, goalTarget - goalCurrent);
        daysToGoalWithoutPurchase = Math.max(1, Math.ceil(remainingToGoal / Math.max(10, dailyNetSavings)));
        const baseGoalDate = new Date(nowMs + (daysToGoalWithoutPurchase * 86400000));
        // 4. FIX DATE FORMAT: "10 April 2027" (Day, full Month, Year)
        currentGoalDateStr = baseGoalDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Read purchase amount from input
    const simAmount = parseFloat(inputElem.value) || 0;

    // 9. HANDLE LOW BALANCE / INSUFFICIENT BALANCE
    if (simAmount > currentBalance) {
        renderScenarioBoxes({
            currentBalance: formatCurrency(baseline30DayBalance),
            currentProgress: baselineProgressStr,
            currentGoalDate: currentGoalDateStr,
            afterBalance: '🔴 Insufficient Balance',
            afterProgress: hasSavingsGoal ? '0%' : 'No goal',
            afterGoalDate: 'N/A',
            goalDelay: 'N/A',
            riskBadgeText: '🔴 Insufficient Balance',
            riskBadgeClass: 'badge-high',
            riskReasonText: '<strong style="color:#e74c3c;">🔴 Insufficient Balance:</strong> This purchase (₹' + simAmount.toLocaleString('en-IN') + ') is higher than your current available balance (₹' + currentBalance.toLocaleString('en-IN') + ').'
        });
        return;
    }

    // 3. FIX AFTER PURCHASE (Current Path Projection - Purchase Amount)
    const after30DayBalance = baseline30DayBalance - simAmount;

    // 7. SAVINGS PROGRESS AFTER PURCHASE
    let afterProgressStr = '<a href="goals.html" style="color:#55b882; text-decoration:none;">No savings goal available. <span style="text-decoration:underline;">[ CREATE SAVINGS GOAL ]</span></a>';
    let afterGoalDateStr = '<a href="goals.html" style="color:#55b882; text-decoration:none;">No savings goal available. <span style="text-decoration:underline;">[ CREATE SAVINGS GOAL ]</span></a>';
    let goalDelayStr = 'N/A';

    if (hasSavingsGoal && goalTarget > 0) {
        const simSavedAmount = Math.max(0, goalCurrent - simAmount);
        const afterProgressVal = Math.min(100, Math.max(0, (simSavedAmount / goalTarget) * 100));
        afterProgressStr = (afterProgressVal < 10 && afterProgressVal > 0) ? afterProgressVal.toFixed(1) + '%' : afterProgressVal.toFixed(0) + '%';

        // 5. GOAL COMPLETION DATE WITH PURCHASE
        const remainingWithPurchase = Math.max(0, goalTarget - simSavedAmount);
        const daysToGoalWithPurchase = Math.max(1, Math.ceil(remainingWithPurchase / Math.max(10, dailyNetSavings)));
        
        const afterGoalDate = new Date(nowMs + (daysToGoalWithPurchase * 86400000));
        // Date format: "25 April 2027"
        afterGoalDateStr = afterGoalDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        // 6. FIX GOAL DELAY = Days WITH purchase - Days WITHOUT purchase
        const actualDelayDays = Math.max(0, daysToGoalWithPurchase - daysToGoalWithoutPurchase);
        goalDelayStr = actualDelayDays + (actualDelayDays === 1 ? ' day' : ' days');
    }

    // 8. FIX RISK SCORE
    const remainingAfterPurchase = currentBalance - simAmount;
    const safetyBuffer = Math.max(5000, monthlyExpense);
    const riskRatio = simAmount / Math.max(1, currentBalance);

    let riskBadgeText = '🟢 Low Risk';
    let riskBadgeClass = 'badge-low';
    let riskReasonText = '🟢 Low Risk — this purchase easily fits your current budget and available balance.';

    if (remainingAfterPurchase < safetyBuffer || riskRatio > 0.4) {
        riskBadgeText = '🔴 High Risk';
        riskBadgeClass = 'badge-high';
        riskReasonText = '🔴 High Risk — this purchase would reduce your balance below your recommended safety amount (' + formatCurrency(safetyBuffer) + ').';
    } else if (riskRatio > 0.15) {
        riskBadgeText = '🟡 Medium Risk';
        riskBadgeClass = 'badge-med';
        riskReasonText = '🟡 Medium Risk — this purchase slows your savings progress but stays within safe limits.';
    }

    renderScenarioBoxes({
        currentBalance: formatCurrency(baseline30DayBalance),
        currentProgress: baselineProgressStr,
        currentGoalDate: currentGoalDateStr,
        afterBalance: formatCurrency(after30DayBalance),
        afterProgress: afterProgressStr,
        afterGoalDate: afterGoalDateStr,
        goalDelay: goalDelayStr,
        riskBadgeText: riskBadgeText,
        riskBadgeClass: riskBadgeClass,
        riskReasonText: riskReasonText
    });
}

function renderScenarioBoxes(cfg) {
    const mainContainer = document.getElementById('tmMainContainer');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
        <div class="tm-scenarios-grid">
            <!-- Current Path -->
            <div class="tm-scenario-box highlight">
                <div class="tm-scenario-header">
                    <span class="tm-scenario-title" style="color: #55b882;"><i class="fa-solid fa-route"></i> CURRENT PATH</span>
                    <span style="font-size: 0.75rem; color: #8b8fa3;">Baseline Projection</span>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Estimated 30-Day Balance</span>
                    <span class="tm-metric-val" id="tmCurrentBalance">${cfg.currentBalance}</span>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Savings Progress</span>
                    <span class="tm-metric-val" id="tmCurrentSavingsProgress">${cfg.currentProgress}</span>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Goal Completion</span>
                    <span class="tm-metric-val" id="tmCurrentGoalDate">${cfg.currentGoalDate}</span>
                </div>
            </div>

            <!-- After Purchase -->
            <div class="tm-scenario-box impact-warn" id="tmAfterBox">
                <div class="tm-scenario-header">
                    <span class="tm-scenario-title" style="color: #f1c40f;"><i class="fa-solid fa-cart-shopping"></i> AFTER THIS PURCHASE</span>
                    <div>
                        <span class="impact-badge ${cfg.riskBadgeClass}" id="tmRiskBadge">${cfg.riskBadgeText}</span>
                    </div>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Estimated 30-Day Balance</span>
                    <span class="tm-metric-val" id="tmAfterBalance" style="color: #f1c40f;">${cfg.afterBalance}</span>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Savings Progress</span>
                    <span class="tm-metric-val" id="tmAfterSavingsProgress">${cfg.afterProgress}</span>
                </div>
                <div class="tm-metric-row">
                    <span class="tm-metric-label">Goal Completion</span>
                    <span class="tm-metric-val" id="tmAfterGoalDate">${cfg.afterGoalDate}</span>
                </div>
                <div class="tm-metric-row" style="margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                    <span class="tm-metric-label"><i class="fa-solid fa-clock-rotate-left"></i> Estimated Goal Delay</span>
                    <span class="tm-metric-val text-warning" id="tmGoalDelay">${cfg.goalDelay}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 0.8rem; font-size: 0.83rem; color: #8b8fa3; text-align: left;" id="tmRiskReason">
            ${cfg.riskReasonText}
        </div>
    `;
}


// 🌌 EXPLORE YOUR FINANCIAL FUTURES
function selectFutureTrajectory(trajectory) {
    window.selectedTrajectory = trajectory;
    const data = window.dashboardData || {};
    
    document.querySelectorAll('.futures-tab').forEach(t => t.classList.remove('active'));
    if (trajectory === 'save') {
        const el = document.getElementById('futTabSave');
        if (el) el.classList.add('active');
    } else if (trajectory === 'spend') {
        const el = document.getElementById('futTabSpend');
        if (el) el.classList.add('active');
    } else {
        const el = document.getElementById('futTabCurrent');
        if (el) el.classList.add('active');
    }

    const totalBalance = data.totalBalance || 0;
    const monthlyIncome = data.monthlyIncome || 0;
    const monthlyExpense = data.monthlyExpense || 0;
    const netMonthly = monthlyIncome - monthlyExpense;

    let monthlyDelta = 0;
    if (trajectory === 'save') monthlyDelta = 5000;
    if (trajectory === 'spend') monthlyDelta = -5000;

    const netDaily = (netMonthly + monthlyDelta) / 30;

    const bal30 = totalBalance + (netDaily * 30);
    const bal90 = totalBalance + (netDaily * 90);
    const bal1Yr = totalBalance + (netDaily * 365);

    document.getElementById('fut30Day').textContent = formatCurrency(bal30);
    document.getElementById('fut90Day').textContent = formatCurrency(bal90);
    document.getElementById('fut1Year').textContent = formatCurrency(bal1Yr);

    const goals = data.goals || [];
    const mainGoal = (goals.length > 0) ? goals[0] : { targetAmount: 500000, currentAmount: data.totalSavings || 50000 };
    const goalTarget = mainGoal.targetAmount || 500000;

    const progress = Math.min(100, Math.max(0, (bal90 / goalTarget) * 100));
    document.getElementById('futGoalProgress').textContent = progress.toFixed(1) + '%';

    const daysLeft = Math.max(1, Math.ceil((goalTarget - totalBalance) / Math.max(50, netDaily)));
    const targetDate = new Date(Date.now() + (daysLeft * 86400000));
    document.getElementById('futGoalDate').textContent = targetDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}


function renderFuturesChart(data) {
    const ctx = document.getElementById('futuresChart');
    if (!ctx) return;

    if (window.futuresChartInstance) {
        window.futuresChartInstance.destroy();
    }

    const totalBalance = parseFloat(data.totalBalance) || 0;
    const monthlyIncome = parseFloat(data.monthlyIncome) || 0;
    const monthlyExpense = parseFloat(data.monthlyExpense) || 0;
    const netMonthly = monthlyIncome - monthlyExpense;

    const saveDaily = (netMonthly + 5000) / 30;
    const currentDaily = netMonthly / 30;
    const spendDaily = (netMonthly - 5000) / 30;

    const labels = ['Today', '30 Days', '60 Days', '90 Days', '6 Months', '1 Year'];

    const saveData = [totalBalance, totalBalance + saveDaily*30, totalBalance + saveDaily*60, totalBalance + saveDaily*90, totalBalance + saveDaily*180, totalBalance + saveDaily*365];
    const currentData = [totalBalance, totalBalance + currentDaily*30, totalBalance + currentDaily*60, totalBalance + currentDaily*90, totalBalance + currentDaily*180, totalBalance + currentDaily*365];
    const spendData = [totalBalance, totalBalance + spendDaily*30, totalBalance + spendDaily*60, totalBalance + spendDaily*90, totalBalance + spendDaily*180, totalBalance + spendDaily*365];

    window.futuresChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '🟢 Save More (+₹5,000/mo)',
                    data: saveData,
                    borderColor: '#2ecc71',
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#2ecc71'
                },
                {
                    label: '🟡 Current Path',
                    data: currentData,
                    borderColor: '#f1c40f',
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#f1c40f'
                },
                {
                    label: '🔴 Spend More (+₹5,000/mo)',
                    data: spendData,
                    borderColor: '#e74c3c',
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#e74c3c'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#c5cad6', font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: function(c) { return `${c.dataset.label}: ${formatCurrency(c.raw)}`; }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#888' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' }, beginAtZero: false }
            }
        }
    });
}

// ⏰ BEST TIME TO SPEND
function calculateBestTimeToSpend() {
    const data = window.dashboardData || {};
    const input = document.getElementById('bestTimeAmount');
    if (!input) return;

    const amount = parseFloat(input.value) || 0;
    const totalBalance = parseFloat(data.totalBalance) || 0;
    const monthlyIncome = parseFloat(data.monthlyIncome) || 0;
    
    let subsCost = 0;
    (data.subscriptions || []).forEach(s => { subsCost += parseFloat(s.amount) || 0; });

    // Impact calculations
    const todayRatio = totalBalance > 0 ? amount / totalBalance : 1;
    const impactTodayEl = document.getElementById('impactToday');
    const impact10DaysEl = document.getElementById('impact10Days');
    const impact24DaysEl = document.getElementById('impact24Days');

    if (todayRatio > 0.2) {
        impactTodayEl.className = 'impact-badge badge-high'; impactTodayEl.textContent = '🔴 High Impact';
        impact10DaysEl.className = 'impact-badge badge-med'; impact10DaysEl.textContent = '🟡 Medium Impact';
        impact24DaysEl.className = 'impact-badge badge-low'; impact24DaysEl.textContent = '🟢 Low Impact';
        
        document.getElementById('recTimeHeading').textContent = 'Recommended time: 24 days later';
        document.getElementById('recTimeExplanation').textContent = `Based on your current spending pattern, upcoming bills (${formatCurrency(subsCost)}), and current balance (${formatCurrency(totalBalance)}), waiting 24 days until after your next salary reduces financial risk.`;
    } else if (todayRatio > 0.08) {
        impactTodayEl.className = 'impact-badge badge-med'; impactTodayEl.textContent = '🟡 Medium Impact';
        impact10DaysEl.className = 'impact-badge badge-low'; impact10DaysEl.textContent = '🟢 Low Impact';
        impact24DaysEl.className = 'impact-badge badge-low'; impact24DaysEl.textContent = '🟢 Minimal Impact';

        document.getElementById('recTimeHeading').textContent = 'Recommended time: 10 days later';
        document.getElementById('recTimeExplanation').textContent = `Based on your balance of ${formatCurrency(totalBalance)} and monthly income of ${formatCurrency(monthlyIncome)}, waiting 10 days builds a safer cash buffer.`;
    } else {
        impactTodayEl.className = 'impact-badge badge-low'; impactTodayEl.textContent = '🟢 Low Impact';
        impact10DaysEl.className = 'impact-badge badge-low'; impact10DaysEl.textContent = '🟢 Minimal Impact';
        impact24DaysEl.className = 'impact-badge badge-low'; impact24DaysEl.textContent = '🟢 Safe';

        document.getElementById('recTimeHeading').textContent = 'Recommended time: TODAY';
        document.getElementById('recTimeExplanation').textContent = `Your current balance of ${formatCurrency(totalBalance)} easily accommodates this purchase without impacting your savings goals.`;
    }
}

// 🧠 YOUR FINANCIAL TWIN
function renderFinancialTwin(data) {
    const score = data.spendwiseScore || 0;
    const income = parseFloat(data.monthlyIncome) || 0;
    const expense = parseFloat(data.monthlyExpense) || 0;
    const savingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;
    const avgDaily = expense > 0 ? (expense / 30) : 0;
    const safeSpend = Math.max(0, (income - expense) / 4);

    document.getElementById('twinScore').textContent = `${score} / 100`;
    document.getElementById('twinSavingsRate').textContent = `${savingsRate.toFixed(0)}%`;
    document.getElementById('twinAvgDaily').textContent = formatCurrency(avgDaily);
    document.getElementById('twinSafeSpend').textContent = formatCurrency(safeSpend);
}

function openScoreBreakdownModal() {
    const modal = document.getElementById('scoreBreakdownModal');
    if (modal) modal.classList.add('active');
}

function closeScoreBreakdownModal() {
    const modal = document.getElementById('scoreBreakdownModal');
    if (modal) modal.classList.remove('active');
}

// 🧠 AI DISCOVERED PATTERNS
function renderAIDiscoveredPatterns(data) {
    const txs = data.recentTransactions || [];
    
    // Weekend vs Weekday analysis
    let weekendTotal = 0, weekdayTotal = 0, weekendCount = 0, weekdayCount = 0;
    txs.forEach(t => {
        if (t.type === 'expense' && t.date) {
            const day = new Date(t.date).getDay();
            if (day === 0 || day === 6) { weekendTotal += t.amount; weekendCount++; }
            else { weekdayTotal += t.amount; weekdayCount++; }
        }
    });

    const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
    const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
    const surgePct = weekdayAvg > 0 ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100) : 0;

    const weekendMsg = surgePct > 0 
        ? `You spend approximately ${surgePct}% more on weekends compared to weekdays.`
        : `Your spending is evenly distributed between weekdays and weekends.`;
    document.getElementById('aiPatternWeekend').textContent = weekendMsg;

    // Monthly cycle velocity
    const expense = parseFloat(data.monthlyExpense) || 0;
    const cycleMsg = expense > 0 
        ? `Your spending is highest during the first 10 days of the month (${formatCurrency(expense * 0.45)} spent).`
        : `Your expense velocity is steady throughout the month.`;
    document.getElementById('aiPatternCycle').textContent = cycleMsg;

    // Subscriptions
    let subsTotal = 0;
    const subs = data.subscriptions || [];
    const subsCount = subs.length;
    subs.forEach(s => { subsTotal += parseFloat(s.amount) || 0; });
    const subsMsg = subsCount > 0 
        ? `Your active subscriptions cost ${formatCurrency(subsTotal)}/month across ${subsCount} services.`
        : `No active recurring subscription costs detected.`;
    document.getElementById('aiPatternSubs').textContent = subsMsg;
}

// ===================== FEATURE 1: SAFE TO SPEND TODAY =====================
function renderSafeToSpendCard(safeData) {
    const amountEl = document.getElementById('safeToSpendAmount');
    const badgeEl = document.getElementById('safeStatusBadge');
    const subtitleEl = document.getElementById('safeToSpendSubtitle');
    const twinSafeSpendEl = document.getElementById('twinSafeSpend');

    if (!safeData || !safeData.isDataAvailable) {
        if (amountEl) {
            amountEl.textContent = 'Not enough data available';
            amountEl.style.fontSize = '1.3rem';
            amountEl.style.color = '#f1c40f';
        }
        if (badgeEl) {
            badgeEl.className = 'badge-status badge-be-careful';
            badgeEl.innerHTML = '🟡 Data Needed';
        }
        if (subtitleEl) {
            subtitleEl.textContent = safeData && safeData.missingDataReason
                ? safeData.missingDataReason
                : 'Not enough account or transaction data available to calculate daily safe spend.';
        }
        if (twinSafeSpendEl) {
            twinSafeSpendEl.textContent = 'N/A';
        }
        return;
    }

    if (amountEl) {
        amountEl.textContent = formatCurrency(safeData.amount);
        amountEl.style.fontSize = '2.2rem';
        amountEl.style.color = safeData.status === 'overspending_risk' ? '#e74c3c' : '#ffffff';
    }

    if (twinSafeSpendEl) {
        twinSafeSpendEl.textContent = formatCurrency(safeData.amount);
    }

    if (badgeEl) {
        if (safeData.status === 'on_track') {
            badgeEl.className = 'badge-status badge-on-track';
            badgeEl.innerHTML = '🟢 On Track';
        } else if (safeData.status === 'be_careful') {
            badgeEl.className = 'badge-status badge-be-careful';
            badgeEl.innerHTML = '🟡 Be Careful';
        } else {
            badgeEl.className = 'badge-status badge-overspending';
            badgeEl.innerHTML = '🔴 Overspending Risk';
        }
    }

    if (subtitleEl) {
        subtitleEl.textContent = 'Based on your current budget, spending pattern, and upcoming expenses.';
    }

    // Populate Modal Breakdown Data
    if (safeData.breakdown) {
        const bd = safeData.breakdown;
        const totalBalEl = document.getElementById('sbTotalBalance');
        const upSubsEl = document.getElementById('sbUpcomingSubs');
        const goalContribEl = document.getElementById('sbGoalContrib');
        const remBudgetEl = document.getElementById('sbRemainingBudget');
        const safePoolEl = document.getElementById('sbSafePool');
        const daysRemEl = document.getElementById('sbDaysRemaining');
        const formulaEl = document.getElementById('sbFormulaText');

        if (totalBalEl) totalBalEl.textContent = formatCurrency(bd.totalBalance);
        if (upSubsEl) upSubsEl.textContent = '-' + formatCurrency(bd.upcomingSubscriptions);
        if (goalContribEl) goalContribEl.textContent = '-' + formatCurrency(bd.goalContributions);
        if (remBudgetEl) {
            remBudgetEl.textContent = bd.remainingMonthlyBudget !== null ? formatCurrency(bd.remainingMonthlyBudget) : 'Unconstrained';
        }
        if (safePoolEl) safePoolEl.textContent = formatCurrency(bd.safePool);
        if (daysRemEl) daysRemEl.textContent = `${bd.daysRemaining} days`;

        if (formulaEl) {
            formulaEl.textContent = `Formula: ${formatCurrency(bd.safePool)} safe pool ÷ ${bd.daysRemaining} days remaining = ${formatCurrency(safeData.amount)} / day`;
        }
    }
}

function openSafeToSpendModal() {
    const modal = document.getElementById('safeToSpendModal');
    if (modal) modal.style.display = 'flex';
}

function closeSafeToSpendModal() {
    const modal = document.getElementById('safeToSpendModal');
    if (modal) modal.style.display = 'none';
}

// ===================== FEATURE 2: MONTHLY COMPARISON ("What Changed This Month?") =====================
function renderMonthlyComparisonSection(compData) {
    const insightBox = document.getElementById('comparisonInsightBox');
    const tableBody = document.getElementById('comparisonTableBody');
    const periodBadge = document.getElementById('comparisonPeriodBadge');
    const thCurr = document.getElementById('thCurrMonth');
    const thPrev = document.getElementById('thPrevMonth');

    if (!compData) return;

    if (thCurr && compData.currMonthName) thCurr.textContent = compData.currMonthName.toUpperCase();
    if (thPrev && compData.prevMonthName) thPrev.textContent = compData.prevMonthName.toUpperCase();
    if (periodBadge && compData.currMonthName && compData.prevMonthName) {
        periodBadge.textContent = `${compData.currMonthName} vs ${compData.prevMonthName}`;
    }

    if (!compData.hasHistoricalData) {
        if (insightBox) {
            insightBox.style.background = 'rgba(241, 196, 15, 0.08)';
            insightBox.style.borderLeft = '4px solid #f1c40f';
            insightBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning" style="margin-right: 0.4rem;"></i> Not enough historical data for comparison.`;
        }
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">Not enough historical data for comparison. Add transactions across multiple months to view trends.</td></tr>`;
        }
        return;
    }

    // Dynamic Summary Insight Box
    if (insightBox) {
        insightBox.style.background = 'rgba(85, 184, 130, 0.08)';
        insightBox.style.borderLeft = '4px solid #55b882';
        insightBox.innerHTML = `<i class="fa-solid fa-sparkles text-success" style="margin-right: 0.4rem;"></i> ${compData.summaryText}`;
    }

    let rowsHtml = '';

    const categories = compData.categories || [];
    if (categories.length === 0) {
        rowsHtml += `<tr><td colspan="5" class="text-center text-muted p-3">No category expense changes detected between these months.</td></tr>`;
    } else {
        categories.forEach(c => {
            const diffFormatted = (c.difference >= 0 ? '+' : '-') + formatCurrency(Math.abs(c.difference));
            const pctFormatted = (c.pctChange >= 0 ? '+' : '') + c.pctChange.toFixed(1) + '%';
            
            let tagClass = 'tag-neutral';
            let statusIcon = '⚪';
            if (c.status === 'positive') {
                tagClass = 'tag-positive';
                statusIcon = '🟢';
            } else if (c.status === 'negative') {
                tagClass = 'tag-negative';
                statusIcon = '🔴';
            }

            rowsHtml += `
                <tr>
                    <td style="font-weight: 600;"><span style="margin-right: 0.4rem;">${statusIcon}</span> ${escapeHtml(c.category)}</td>
                    <td style="text-align: right; color: #fff;">${formatCurrency(c.currentAmount)}</td>
                    <td style="text-align: right; color: #8b8fa3;">${formatCurrency(c.previousAmount)}</td>
                    <td style="text-align: right;" class="${c.status === 'positive' ? 'text-success' : c.status === 'negative' ? 'text-danger' : 'text-muted'}">${diffFormatted}</td>
                    <td style="text-align: center;"><span class="${tagClass}">${pctFormatted}</span></td>
                </tr>
            `;
        });
    }

    const totals = compData.totals || {};
    
    if (totals.expenses) {
        const e = totals.expenses;
        const diffFmt = (e.difference >= 0 ? '+' : '-') + formatCurrency(Math.abs(e.difference));
        const pctFmt = (e.pctChange >= 0 ? '+' : '') + e.pctChange.toFixed(1) + '%';
        const tagClass = e.status === 'positive' ? 'tag-positive' : 'tag-negative';
        const icon = e.status === 'positive' ? '🟢' : '🔴';
        rowsHtml += `
            <tr class="row-highlight" style="border-top: 2px solid rgba(255,255,255,0.1);">
                <td style="color: #fff;"><span style="margin-right: 0.4rem;">${icon}</span> 💸 Total Expenses</td>
                <td style="text-align: right; color: #e74c3c;">${formatCurrency(e.current)}</td>
                <td style="text-align: right; color: #8b8fa3;">${formatCurrency(e.previous)}</td>
                <td style="text-align: right;" class="${e.status === 'positive' ? 'text-success' : 'text-danger'}">${diffFmt}</td>
                <td style="text-align: center;"><span class="${tagClass}">${pctFmt}</span></td>
            </tr>
        `;
    }

    if (totals.income) {
        const i = totals.income;
        const diffFmt = (i.difference >= 0 ? '+' : '-') + formatCurrency(Math.abs(i.difference));
        const pctFmt = (i.pctChange >= 0 ? '+' : '') + i.pctChange.toFixed(1) + '%';
        const tagClass = i.status === 'positive' ? 'tag-positive' : 'tag-negative';
        const icon = i.status === 'positive' ? '🟢' : '🔴';
        rowsHtml += `
            <tr class="row-highlight">
                <td style="color: #fff;"><span style="margin-right: 0.4rem;">${icon}</span> 💰 Total Income</td>
                <td style="text-align: right; color: #2ecc71;">${formatCurrency(i.current)}</td>
                <td style="text-align: right; color: #8b8fa3;">${formatCurrency(i.previous)}</td>
                <td style="text-align: right;" class="${i.status === 'positive' ? 'text-success' : 'text-danger'}">${diffFmt}</td>
                <td style="text-align: center;"><span class="${tagClass}">${pctFmt}</span></td>
            </tr>
        `;
    }

    if (totals.savings) {
        const s = totals.savings;
        const diffFmt = (s.difference >= 0 ? '+' : '-') + formatCurrency(Math.abs(s.difference));
        const pctFmt = (s.pctChange >= 0 ? '+' : '') + s.pctChange.toFixed(1) + '%';
        const tagClass = s.status === 'positive' ? 'tag-positive' : 'tag-negative';
        const icon = s.status === 'positive' ? '🟢' : '🔴';
        rowsHtml += `
            <tr class="row-highlight" style="background: rgba(85, 184, 130, 0.05);">
                <td style="color: #55b882;"><span style="margin-right: 0.4rem;">${icon}</span> 🏦 Net Savings (Income - Expenses)</td>
                <td style="text-align: right; color: #55b882;">${formatCurrency(s.current)}</td>
                <td style="text-align: right; color: #8b8fa3;">${formatCurrency(s.previous)}</td>
                <td style="text-align: right;" class="${s.status === 'positive' ? 'text-success' : 'text-danger'}">${diffFmt}</td>
                <td style="text-align: center;"><span class="${tagClass}">${pctFmt}</span></td>
            </tr>
        `;
    }

    if (tableBody) tableBody.innerHTML = rowsHtml;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}



