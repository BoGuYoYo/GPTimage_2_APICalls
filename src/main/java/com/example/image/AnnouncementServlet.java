package com.example.image;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/announcement")
public class AnnouncementServlet extends HttpServlet {

    // Announcement text is backend-only; frontend can only read it.
    private static final String ANNOUNCEMENT =
            "感谢使用我的API调用工具，在使用本软件前请查看中转站是否支持对应模型。\n"
            + "如遇到请求失败，请检查 Key、额度、网络和接口地址配置。";

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json; charset=UTF-8");
        String escaped = ANNOUNCEMENT
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "")
                .replace("\n", "\\n");
        resp.getWriter().write("{\"content\":\"" + escaped + "\"}");
    }
}
