package com.spendwise.controller;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.spendwise.dao.AccountDao;
import com.spendwise.model.Account;
import com.spendwise.model.User;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.List;

@WebServlet("/api/accounts/*")
public class AccountServlet extends HttpServlet {
    private AccountDao accountDao;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        accountDao = new AccountDao();
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

        List<Account> accounts = accountDao.getAccountsByUserId(user.getUserId());
        resp.getWriter().write(gson.toJson(accounts));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        User user = getUser(req, resp);
        if (user == null) return;

        String pathInfo = req.getPathInfo();
        JsonObject responseJson = new JsonObject();

        try {
            if ("/link".equals(pathInfo)) {
                // Read JSON body
                BufferedReader reader = req.getReader();
                JsonObject jsonBody = gson.fromJson(reader, JsonObject.class);
                String providerName = jsonBody != null && jsonBody.has("providerName") ? jsonBody.get("providerName").getAsString() : null;

                if (providerName == null || providerName.trim().isEmpty()) {
                    resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    responseJson.addProperty("error", "Provider name is required");
                    resp.getWriter().write(gson.toJson(responseJson));
                    return;
                }

                if (accountDao.checkIfAccountExists(user.getUserId(), providerName)) {
                    resp.setStatus(HttpServletResponse.SC_CONFLICT);
                    responseJson.addProperty("error", "This bank is already connected to your account.");
                    resp.getWriter().write(gson.toJson(responseJson));
                    return;
                }

                boolean isWallet = providerName.toLowerCase().contains("wallet") || 
                                   providerName.toLowerCase().contains("paytm") || 
                                   providerName.toLowerCase().contains("phonepe");
                String accountType = isWallet ? "wallet" : "bank_account";

                double mockBalance = Math.round((Math.random() * 40000 + 5000) * 100.0) / 100.0;
                String mockMask = String.valueOf((int) (Math.random() * 9000) + 1000);

                Account a = new Account();
                a.setUserId(user.getUserId());
                a.setProviderName(providerName);
                a.setAccountType(accountType);
                a.setBalance(mockBalance);
                a.setAccountMask(mockMask);

                if (accountDao.addAccount(a)) {
                    responseJson.addProperty("success", true);
                    responseJson.addProperty("message", "Account connected successfully");
                } else {
                    resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    responseJson.addProperty("error", "Failed to link account");
                }
            } else {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                responseJson.addProperty("error", "Invalid endpoint");
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            responseJson.addProperty("error", "Invalid data: " + e.getMessage());
        }
        resp.getWriter().write(gson.toJson(responseJson));
    }
}
