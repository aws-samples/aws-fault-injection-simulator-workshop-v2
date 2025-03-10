# Start from the official Golang image
FROM --platform=linux/amd64 public.ecr.aws/docker/library/golang:1.23.6-alpine

ENV GOPROXY=https://goproxy.io,direct

# Add necessary tools
RUN apk add --no-cache ca-certificates tzdata git

# Set working directory
WORKDIR /app

# Clone the repository
RUN git clone https://github.com/mrvladis/aws_az_monitor.git .

# Download dependencies
RUN go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o monitor 

# Create a non-root user
RUN adduser -D appuser
USER appuser

# Set environment variable for polling interval (15 seconds)
ENV POLLING_INTERVAL=15

# Run the application
CMD ["./monitor"]