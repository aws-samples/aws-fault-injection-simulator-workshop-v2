FROM golang:1.23-alpine AS builder
ENV GOPROXY=https://proxy.golang.org,direct
WORKDIR /go/src/app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /go/src/app/app .
EXPOSE 8000
CMD ["./app"]
