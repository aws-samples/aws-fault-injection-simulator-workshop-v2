FROM --platform=linux/amd64 golang:1.24-alpine AS builder
WORKDIR /go/src/app
COPY . .
RUN apk --no-cache add git
ENV GOPROXY=direct
RUN go get .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o app .

FROM --platform=linux/amd64 alpine:3.20
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /go/src/app/app .
EXPOSE 80
CMD ["./app"]
