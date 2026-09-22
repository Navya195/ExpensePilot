package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.UserDao;
import com.spendwise.model.User;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;

@WebServlet("/api/auth/*")
public class AuthServlet extends HttpServlet {
    private UserDao userDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        userDao = new UserDao();
        gson = new Gson();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Not logged in\"}");
            return;
        }
        User user = (User) session.getAttribute("user");
        JsonObject json = new JsonObject();
        json.addProperty("name", user.getName());
        json.addProperty("email", user.getEmail());
        json.addProperty("userId", user.getUserId());
        if (user.getCreatedAt() != null) json.addProperty("createdAt", user.getCreatedAt().toString());
        response.getWriter().write(gson.toJson(json));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String pathInfo = request.getPathInfo();
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        
        if ("/login".equals(pathInfo)) {
            handleLogin(request, response);
        } else if ("/register".equals(pathInfo)) {
            handleRegister(request, response);
        } else if ("/logout".equals(pathInfo)) {
            handleLogout(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.getWriter().write("{\"error\": \"Endpoint not found\"}");
        }
    }

    private void handleLogin(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Since we will use AJAX/Fetch to submit, we can parse JSON or standard form.
        // Let's assume standard form for now for simplicity based on the HTML written,
        // but it's better to update frontend to fetch. We'll support form data here.
        String email = request.getParameter("email");
        String password = request.getParameter("password");

        JsonObject jsonResponse = new JsonObject();

        if (email == null || password == null || email.isEmpty() || password.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            jsonResponse.addProperty("error", "Email and password are required.");
            response.getWriter().write(gson.toJson(jsonResponse));
            return;
        }

        User user = userDao.loginUser(email, password);
        
        if (user != null) {
            HttpSession session = request.getSession();
            session.setAttribute("user", user);
            
            jsonResponse.addProperty("success", true);
            jsonResponse.addProperty("message", "Login successful");
            jsonResponse.addProperty("redirect", "dashboard.html");
            response.getWriter().write(gson.toJson(jsonResponse));
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            jsonResponse.addProperty("success", false);
            jsonResponse.addProperty("error", "Invalid email or password");
            response.getWriter().write(gson.toJson(jsonResponse));
        }
    }

    private void handleRegister(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String name = request.getParameter("name");
        String email = request.getParameter("email");
        String password = request.getParameter("password");
        
        JsonObject jsonResponse = new JsonObject();

        if (name == null || email == null || password == null || name.trim().isEmpty() || email.trim().isEmpty() || password.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            jsonResponse.addProperty("error", "All fields are required.");
            response.getWriter().write(gson.toJson(jsonResponse));
            return;
        }

        if (!email.matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            jsonResponse.addProperty("error", "Invalid email address.");
            response.getWriter().write(gson.toJson(jsonResponse));
            return;
        }

        if (password.length() < 6) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            jsonResponse.addProperty("error", "Password must meet the required requirements.");
            response.getWriter().write(gson.toJson(jsonResponse));
            return;
        }

        if (userDao.emailExists(email)) {
            response.setStatus(HttpServletResponse.SC_CONFLICT);
            jsonResponse.addProperty("error", "Email address is already registered.");
            response.getWriter().write(gson.toJson(jsonResponse));
            return;
        }

        User newUser = new User();
        newUser.setName(name.trim());
        newUser.setEmail(email.trim());
        newUser.setPassword(password);

        if (userDao.registerUser(newUser)) {
            jsonResponse.addProperty("success", true);
            jsonResponse.addProperty("message", "Registration successful!");
            jsonResponse.addProperty("redirect", "login.html");
            response.getWriter().write(gson.toJson(jsonResponse));
        } else {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            jsonResponse.addProperty("error", "Unable to connect to the server. Please try again.");
            response.getWriter().write(gson.toJson(jsonResponse));
        }
    }
    
    private void handleLogout(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        JsonObject jsonResponse = new JsonObject();
        jsonResponse.addProperty("success", true);
        jsonResponse.addProperty("redirect", "login.html");
        response.getWriter().write(gson.toJson(jsonResponse));
    }
}
