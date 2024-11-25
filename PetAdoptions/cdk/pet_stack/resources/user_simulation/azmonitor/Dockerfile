# Start from the official Golang image
FROM  --platform=linux/amd64 golang:1.23.3-alpine

ENV GOPROXY=https://goproxy.io,direct

# Add necessary tools
RUN apk add --no-cache ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod and sum files
COPY app/go.mod app/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY app/. .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o monitor

# Create a non-root user
RUN adduser -D appuser
USER appuser

# Set environment variable for polling interval (15 seconds)
ENV POLLING_INTERVAL=15

# Run the application
CMD ["./monitor"]
