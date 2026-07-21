FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/aspnet:8.0-bookworm-slim AS base
WORKDIR /app
# .NET 8 base images default Kestrel to port 8080; the ECS task/ALB target this
# container on port 80, so pin the listening port back to 80 (the .NET 6/7 default).
ENV ASPNETCORE_HTTP_PORTS=80
EXPOSE 80
EXPOSE 443

FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS build
WORKDIR /src
COPY . .
# .NET 8 needs this on Apple Silicon (Rosetta) to let `dotnet restore` complete
ENV DOTNET_EnableWriteXorExecute=0
RUN dotnet restore "trafficgenerator.csproj"
RUN dotnet build "trafficgenerator.csproj" -c Release -o /app/build  -a x64

FROM build AS publish
RUN dotnet publish "trafficgenerator.csproj" -c Release -o /app/publish 

FROM base AS final
WORKDIR /app
#ENV DOTNET_ENVIRONMENT=Development
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "trafficgenerator.dll"]
