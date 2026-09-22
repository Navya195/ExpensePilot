package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.BudgetDao;
import com.spendwise.dao.TransactionDao;
import com.spendwise.model.Budget;
import com.spendwise.model.User;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.util.*;

@WebServlet("/api/budgets/*")
public class BudgetServlet extends HttpServlet {
    private BudgetDao budgetDao;
    private TransactionDao txDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        budgetDao = new BudgetDao();
        txDao = new TransactionDao();
        gson = new Gson();
    }

    private User getUser(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\": \"Not logged in\"}");
            return null;
        }
        return (User) session.getAttribute("user");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        List<Budget> budgets = budgetDao.getAllBudgets(user.getUserId());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Budget b : budgets) {
            Map<String, Object> map = new HashMap<>();
            map.put("budgetId", b.getBudgetId());
            map.put("category", b.getCategory());
            map.put("monthlyLimit", b.getMonthlyLimit());
            double spent = txDao.getCategoryExpenseThisMonth(user.getUserId(), b.getCategory());
            map.put("spent", spent);
            double pct = b.getMonthlyLimit() > 0 ? (spent / b.getMonthlyLimit()) * 100 : 0;
            map.put("percentage", pct);
            result.add(map);
        }
        resp.getWriter().write(gson.toJson(result));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        JsonObject json = new JsonObject();
        try {
            Budget b = new Budget();
            b.setUserId(user.getUserId());
            b.setCategory(req.getParameter("category"));
            b.setMonthlyLimit(Double.parseDouble(req.getParameter("monthlyLimit")));

            if (budgetDao.addBudget(b)) {
                json.addProperty("success", true);
                json.addProperty("message", "Budget added");
            } else {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                json.addProperty("error", "Failed to add budget");
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            json.addProperty("error", "Invalid data: " + e.getMessage());
        }
        resp.getWriter().write(gson.toJson(json));
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        JsonObject json = new JsonObject();
        try {
            int id = Integer.parseInt(req.getParameter("id"));
            if (budgetDao.deleteBudget(id, user.getUserId())) {
                json.addProperty("success", true);
            } else {
                json.addProperty("error", "Budget not found");
            }
        } catch (Exception e) {
            json.addProperty("error", "Invalid data");
        }
        resp.getWriter().write(gson.toJson(json));
    }
}
