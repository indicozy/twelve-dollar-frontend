# Spring Boot 4.1 (Spring MVC + Thymeleaf, embedded Tomcat) for the 2-server simulation (sim/): SSR on every
# request, no caching, one JVM process.
FROM maven:3.10.0-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml ./
# Dependencies first, so source edits don't re-download them.
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:25.0.4.1_1-jre
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HOST=0.0.0.0 PORT=3000
# The Boot fat jar holds the app, Spring, Thymeleaf and Tomcat. No JVM flags: the JVM's container ergonomics pick
# the GC and heap (SerialGC and a 512 MB max heap on 1 vCPU / 2 GB).
COPY --from=build /app/target/spring.jar ./app.jar
# JVM startup takes a few seconds on 1 vCPU; failures during the start period don't count.
HEALTHCHECK --interval=2s --retries=30 --start-period=30s CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec java -jar app.jar"]
