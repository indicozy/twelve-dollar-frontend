# spring-tuned: ../spring plus a JDK 25 AOT cache, virtual threads and the Thymeleaf SpEL compiler (README.md, "Tuning").
# Spring Boot 4.1 (Spring MVC + Thymeleaf, embedded Tomcat), SSR on every request, no caching, one JVM process.
FROM maven:3.10.0-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:25.0.4.1_1-jre
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HOST=0.0.0.0 PORT=3000
COPY --from=build /app/target/spring.jar ./spring.jar
# AOT cache (JEP 483/514, the JDK 25 successor of AppCDS; Spring Boot documents this exact recipe): unpack the fat jar so
# classes load from plain jars, then do one training start that exits after the context refresh
# (-Dspring.context.exit=onRefresh). The JVM writes app.aot with those classes already loaded and linked (plus the
# method profiles it gathered), and every later start maps it instead of redoing that work at 0.4 CPU.
RUN java -Djarmode=tools -jar spring.jar extract --destination /app/x && cd /app/x \
 && java -XX:AOTCacheOutput=/app/x/app.aot -Dspring.context.exit=onRefresh -jar spring.jar && ls -la /app/x
WORKDIR /app/x
HEALTHCHECK --interval=2s --retries=30 --start-period=30s CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec java -XX:AOTCache=/app/x/app.aot -jar spring.jar"]
