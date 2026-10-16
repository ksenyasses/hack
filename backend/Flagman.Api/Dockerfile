FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Flagman.Api.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV TZ=Europe/Moscow
EXPOSE 8080
CMD ["sh", "-c", "exec dotnet Flagman.Api.dll --urls http://+:${PORT:-8080}"]