package com.example.image;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@WebServlet("/api/generate")
public class ImageGenerateServlet extends HttpServlet {

    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");
        req.setCharacterEncoding("UTF-8");

        // 1) 读取前端 JSON
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(req.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
        }

        JsonNode body = mapper.readTree(sb.toString());
        String prompt = body.path("prompt").asText("").trim();

        if (prompt.isEmpty()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"prompt 不能为空\"}");
            return;
        }

        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\":\"服务器未配置 OPENAI_API_KEY\"}");
            return;
        }

        try {
            // 2) 调用 OpenAI Images API
            String payload = """
            {
              "model": "gpt-image-1",
              "prompt": %s,
              "size": "1024x1024"
            }
            """.formatted(mapper.writeValueAsString(prompt));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://openai.com/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> apiResp = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (apiResp.statusCode() < 200 || apiResp.statusCode() >= 300) {
                resp.setStatus(apiResp.statusCode());
                resp.getWriter().write(apiResp.body());
                return;
            }

            // 3) 把 API 返回透传给前端
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getWriter().write(apiResp.body());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\":\"请求中断\"}");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\":\"生成失败: " + e.getMessage().replace("\"", "\\\"") + "\"}");
        }
    }
}
