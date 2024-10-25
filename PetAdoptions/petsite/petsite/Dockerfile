FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/aspnet:7.0-bullseye-slim-amd64 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/sdk:7.0-bullseye-slim-amd64 AS build
WORKDIR /src
COPY . .

# If using arm-based mac (m1, m2, m3...) you need to enable rosetta on your container settings to successfully compile this code
# As of macOS Ventura, Rosetta 2 has gained the ability to translate x86-64 code within Linux virtual machines running on Apple Silicon Macs.
# Make sure your finch settings (~/.finch/finch.yaml) have this entry (and make sure to restart the finch vm if you make changes):
#     rosetta: true
# This is needed for .net 6, 7 & 8 (should be fixed on .net9 see https://github.com/dotnet/runtime/pull/102509) 
#
# Also for .net 7 & 8 you also need to uncomment this line to get `dotnet restore` to complete
ENV DOTNET_EnableWriteXorExecute=0

RUN dotnet restore "PetSite.csproj" 
RUN dotnet build "PetSite.csproj" -c Release -o /app/build  -a x64

FROM build AS publish
RUN dotnet publish "PetSite.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
#ENV AWS_XRAY_DAEMON_ADDRESS=xray-service.default
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PetSite.dll"]
