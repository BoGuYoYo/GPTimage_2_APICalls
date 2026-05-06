# ===== 构建阶段 =====
FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q clean package -DskipTests

# ===== 运行阶段 =====
FROM tomcat:10.1-jdk17-temurin

# 删除默认应用（可选）
RUN rm -rf /usr/local/tomcat/webapps/*

# 把 war 复制为 ROOT.war，访问路径就是 /
COPY --from=builder /app/target/*.war /usr/local/tomcat/webapps/ROOT.war

EXPOSE 8080
CMD ["catalina.sh", "run"]
