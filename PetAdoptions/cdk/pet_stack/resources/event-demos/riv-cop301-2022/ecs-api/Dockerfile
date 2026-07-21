FROM golang:1.24 AS builder
ENV GOPROXY=https://proxy.golang.org,direct
WORKDIR /go/src/app
COPY . .
RUN go get .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

FROM alpine:3.20
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /go/src/app/app .
EXPOSE 8000
CMD ["./app"]
