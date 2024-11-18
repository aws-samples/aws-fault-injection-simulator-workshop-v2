cat > README.md << 'EOL'
# AWS Auto Scaling Group Monitor

A Go application that monitors AWS Auto Scaling Groups (ASGs) and reports instance health metrics to CloudWatch.

## Description

This application provides real-time monitoring of AWS Auto Scaling Groups by:
- Tracking the number of healthy and in-service instances per Availability Zone
- Reporting metrics to CloudWatch for monitoring and alerting
- Providing console output of instance distribution across AZs

## Features

- Retrieves information about all Auto Scaling Groups in your AWS account
- Counts healthy and in-service instances per Availability Zone
- Publishes custom metrics to CloudWatch:
  - `HealthyInstancesInAZ`: Number of healthy instances per AZ
  - `TotalHealthyInstances`: Total number of healthy instances across all AZs
- Handles CloudWatch API limitations with batch processing

## Prerequisites

- Go 1.x or higher
- AWS credentials configured
- Appropriate IAM permissions:
  - `autoscaling:DescribeAutoScalingGroups`
  - `cloudwatch:PutMetricData`

## Installation

1. Clone the repository
2. Install dependencies:
```bash
go mod tidy

```

# Configuration

Ensure your AWS credentials are properly configured using one of the following methods:

- AWS CLI configuration
- Environment variables
- IAM role (if running on AWS infrastructure)

# Usage

Run the application:

```bash
go run monitor.go
```

# CloudWatch Metrics

The application publishes metrics under the CustomASGMetrics namespace:

## HealthyInstancesInAZ
Dimensions:
- AutoScalingGroupName
- AvailabilityZone

Unit: Count

## TotalHealthyInstances
Dimensions:
- AutoScalingGroupName

Unit: Count

# Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

# License

MIT License

Copyright (c) 2024 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```