# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore project files independently so package restoration remains cached.
COPY src/AfghanVerify.Core/AfghanVerify.Core.csproj src/AfghanVerify.Core/
COPY src/AfghanVerify.Infrastructure/AfghanVerify.Infrastructure.csproj src/AfghanVerify.Infrastructure/
COPY src/AfghanVerify.WebApi/AfghanVerify.WebApi.csproj src/AfghanVerify.WebApi/
RUN dotnet restore src/AfghanVerify.WebApi/AfghanVerify.WebApi.csproj

COPY src/ src/
RUN dotnet publish src/AfghanVerify.WebApi/AfghanVerify.WebApi.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
RUN mkdir -p /var/afghanverify-keys && chown -R $APP_UID:$APP_UID /var/afghanverify-keys

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["dotnet", "AfghanVerify.WebApi.dll"]
