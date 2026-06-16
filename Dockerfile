# syntax=docker/dockerfile:1

FROM node:24-alpine AS web-build
WORKDIR /src/src/alertblurty.Web
COPY src/alertblurty.Web/package*.json ./
RUN npm ci
COPY src/alertblurty.Web ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY alertblurty.sln ./
COPY src/alertblurty.Models/alertblurty.Models.csproj src/alertblurty.Models/
COPY src/alertblurty.Data/alertblurty.Data.csproj src/alertblurty.Data/
COPY src/alertblurty.Api/alertblurty.Api.csproj src/alertblurty.Api/
RUN dotnet restore src/alertblurty.Api/alertblurty.Api.csproj
COPY src ./src
COPY --from=web-build /src/src/alertblurty.Web/dist ./src/alertblurty.Api/wwwroot
RUN dotnet publish src/alertblurty.Api/alertblurty.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ALERTYBLURTY_CONFIG_PATH=/app/data/appsettings.Local.json
RUN mkdir -p /app/data
COPY --from=api-build /app/publish ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "alertblurty.Api.dll"]
