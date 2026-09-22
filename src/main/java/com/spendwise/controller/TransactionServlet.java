package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.TransactionDao;
import com.spendwise.model.Transaction;
import com.spendwise.model.User;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.sql.Date;
import java.util.List;

@WebServlet("/api/transactions/*")
public class TransactionServlet extends HttpServlet {
    private TransactionDao dao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        dao = new TransactionDao();
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

        List<Transaction> transactions = dao.getAllTransactions(user.getUserId());
        resp.getWriter().write(gson.toJson(transactions));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        JsonObject json = new JsonObject();
        try {
            Transaction t = new Transaction();
            t.setUserId(user.getUserId());
            t.setType(req.getParameter("type"));
            t.setAmount(Double.parseDouble(req.getParameter("amount")));
            t.setCategory(req.getParameter("category"));
            t.setDate(Date.valueOf(req.getParameter("date")));
            t.setDescription(req.getParameter("description"));

            if (dao.addTransaction(t)) {
                json.addProperty("success", true);
                json.addProperty("message", "Transaction added");
            } else {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                json.addProperty("error", "Failed to add transaction");
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            json.addProperty("error", "Invalid data: " + e.getMessage());
        }
        resp.getWriter().write(gson.toJson(json));
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        JsonObject json = new JsonObject();
        try {
            Transaction t = new Transaction();
            t.setTransactionId(Integer.parseInt(req.getParameter("transactionId")));
            t.setUserId(user.getUserId());
            t.setType(req.getParameter("type"));
            t.setAmount(Double.parseDouble(req.getParameter("amount")));
            t.setCategory(req.getParameter("category"));
            t.setDate(Date.valueOf(req.getParameter("date")));
            t.setDescription(req.getParameter("description"));

            if (dao.updateTransaction(t)) {
                json.addProperty("success", true);
                json.addProperty("message", "Transaction updated");
            } else {
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                json.addProperty("error", "Failed to update transaction");
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
            int txId = Integer.parseInt(req.getParameter("id"));
            if (dao.deleteTransaction(txId, user.getUserId())) {
                json.addProperty("success", true);
                json.addProperty("message", "Transaction deleted");
            } else {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                json.addProperty("error", "Transaction not found");
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            json.addProperty("error", "Invalid data: " + e.getMessage());
        }
        resp.getWriter().write(gson.toJson(json));
    }
}
