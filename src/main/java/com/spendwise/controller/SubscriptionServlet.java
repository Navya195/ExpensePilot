package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.SubscriptionDao;
import com.spendwise.model.Subscription;
import com.spendwise.model.User;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.sql.Date;
import java.util.*;

@WebServlet("/api/subscriptions/*")
public class SubscriptionServlet extends HttpServlet {
    private SubscriptionDao subDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        subDao = new SubscriptionDao();
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

        Map<String, Object> result = new HashMap<>();
        List<Subscription> subs = subDao.getAllSubscriptions(user.getUserId());
        result.put("subscriptions", subs);
        result.put("totalMonthlyCost", subDao.getTotalMonthlyCost(user.getUserId()));

        // Calculate yearly cost
        double yearlyCost = 0;
        for (Subscription s : subs) {
            if ("monthly".equals(s.getBillingCycle())) {
                yearlyCost += s.getAmount() * 12;
            } else {
                yearlyCost += s.getAmount();
            }
        }
        result.put("totalYearlyCost", yearlyCost);

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
            Subscription s = new Subscription();
            s.setUserId(user.getUserId());
            s.setSubName(req.getParameter("subName"));
            s.setAmount(Double.parseDouble(req.getParameter("amount")));
            s.setBillingCycle(req.getParameter("billingCycle"));
            String nextDate = req.getParameter("nextBillingDate");
            if (nextDate != null && !nextDate.isEmpty()) {
                s.setNextBillingDate(Date.valueOf(nextDate));
            }
            if (subDao.addSubscription(s)) {
                json.addProperty("success", true);
                json.addProperty("message", "Subscription added");
            } else {
                json.addProperty("error", "Failed to add subscription");
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
            if (subDao.deleteSubscription(id, user.getUserId())) {
                json.addProperty("success", true);
            } else {
                json.addProperty("error", "Subscription not found");
            }
        } catch (Exception e) {
            json.addProperty("error", "Invalid data");
        }
        resp.getWriter().write(gson.toJson(json));
    }
}
