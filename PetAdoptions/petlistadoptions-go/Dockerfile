FROM --platform=linux/amd64 golang:1.20 as builder
WORKDIR /go/src/app
COPY . .
ENV GOPROXY=https://goproxy.io,direct
RUN go get .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o app .

FROM --platform=linux/amd64 alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /go/src/app/app .
EXPOSE 80
CMD ["./app"]
