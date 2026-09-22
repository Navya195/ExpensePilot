package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.GoalDao;
import com.spendwise.model.Goal;
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

@WebServlet("/api/goals/*")
public class GoalServlet extends HttpServlet {
    private GoalDao goalDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        goalDao = new GoalDao();
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

        List<Goal> goals = goalDao.getAllGoals(user.getUserId());
        resp.getWriter().write(gson.toJson(goals));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        String pathInfo = req.getPathInfo();
        JsonObject json = new JsonObject();

        try {
            if ("/contribute".equals(pathInfo)) {
                // Add money to a goal
                int goalId = Integer.parseInt(req.getParameter("goalId"));
                double amount = Double.parseDouble(req.getParameter("amount"));
                if (goalDao.addToGoal(goalId, user.getUserId(), amount)) {
                    json.addProperty("success", true);
                    json.addProperty("message", "Contribution added");
                } else {
                    json.addProperty("error", "Failed to add contribution");
                }
            } else {
                // Create new goal
                Goal g = new Goal();
                g.setUserId(user.getUserId());
                g.setGoalName(req.getParameter("goalName"));
                g.setTargetAmount(Double.parseDouble(req.getParameter("targetAmount")));
                g.setCurrentAmount(0);
                String deadline = req.getParameter("deadline");
                if (deadline != null && !deadline.isEmpty()) {
                    g.setDeadline(Date.valueOf(deadline));
                }
                if (goalDao.addGoal(g)) {
                    json.addProperty("success", true);
                    json.addProperty("message", "Goal created");
                } else {
                    json.addProperty("error", "Failed to create goal");
                }
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
            if (goalDao.deleteGoal(id, user.getUserId())) {
                json.addProperty("success", true);
            } else {
                json.addProperty("error", "Goal not found");
            }
        } catch (Exception e) {
            json.addProperty("error", "Invalid data");
        }
        resp.getWriter().write(gson.toJson(json));
    }
}
