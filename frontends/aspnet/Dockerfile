# ASP.NET Core Razor Pages (.NET 10 LTS, Kestrel) for the 2-server simulation (sim/): SSR on every request, no caching,
# one process. Framework-dependent publish on the official SDK image, run on the official ASP.NET Core runtime image.
FROM mcr.microsoft.com/dotnet/sdk:10.0.401 AS build
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
WORKDIR /src
COPY Feed.csproj global.json ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.12
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# HOST/PORT become the Kestrel URL (Program.cs). The base image sets ASPNETCORE_HTTP_PORTS=8080; clear it so the
# only binding is HOST:PORT. Server GC and the default thread pool are left as the runtime picks them.
ENV ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_HTTP_PORTS= HOST=0.0.0.0 PORT=3000
COPY --from=build /app ./
HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec dotnet Feed.dll"]
