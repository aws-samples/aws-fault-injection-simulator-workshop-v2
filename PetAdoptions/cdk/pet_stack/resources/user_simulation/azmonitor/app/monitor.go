package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/autoscaling"
	asgtypes "github.com/aws/aws-sdk-go-v2/service/autoscaling/types"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cwtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	rdstypes "github.com/aws/aws-sdk-go-v2/service/rds/types"
)

func main() {
	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Unable to load SDK config: %v", err)
	}

	// Create  clients
	client := autoscaling.NewFromConfig(cfg)
	cwClient := cloudwatch.NewFromConfig(cfg)
	rdsClient := rds.NewFromConfig(cfg)

	// Get polling interval from environment variable, default to 15 seconds
	pollingInterval := 15
	if interval, exists := os.LookupEnv("POLLING_INTERVAL"); exists {
		if i, err := strconv.Atoi(interval); err == nil {
			pollingInterval = i
		}
	}

	// Main monitoring loop
	for {
		// Get all Auto Scaling groups
		listASGs, err := getASGs(client)
		if err != nil {
			log.Fatalf("Unable to describe Auto Scaling groups: %v", err)
		}

		// Process each Auto Scaling group
		for _, asg := range listASGs {

			// Create a map to store instance counts per AZ
			azCounts := make(AZInstanceCount)

			// Count instances per AZ that are healthy and in service
			for _, instance := range asg.Instances {
				if isHealthyAndInService(instance) {
					azCounts[*instance.AvailabilityZone]++
				} 
			}
			// Print and send metrics to CloudWatch
			fmt.Printf("\nAuto Scaling Group: %s\n", *asg.AutoScalingGroupName)
			fmt.Printf("Healthy and InService instances per AZ:\n")

			if len(azCounts) != len(asg.AvailabilityZones){
				for _, az := range asg.AvailabilityZones {
					count, counted := azCounts[az]
					if counted {
						fmt.Printf("\nAvailability Zone[%s] counted. It had [%s] instances. \n", az, count)
					} else {
						fmt.Printf("\nAvailability Zone[%s] not counted for Unhealthy counted \n", az)
						azCounts[az]=0
					}
				}
			}


			if len(azCounts) == 0 {
				fmt.Println("No healthy and in-service instances found")
			} else {
				// Prepare metrics data
				var metricData []cwtypes.MetricDatum
				totalInstances := 0

				// Create metrics for each AZ
				for az, count := range azCounts {
					fmt.Printf("  %s: %d instances\n", az, count)
					totalInstances += count

					// Create metric for this AZ
					metricData = append(metricData, cwtypes.MetricDatum{
						MetricName: aws.String("HealthyInstancesInAZ"),
						Value:      aws.Float64(float64(count)),
						Timestamp:  aws.Time(time.Now()),
						Dimensions: []cwtypes.Dimension{
							{
								Name:  aws.String("AutoScalingGroupName"),
								Value: asg.AutoScalingGroupName,
							},
							{
								Name:  aws.String("AvailabilityZone"),
								Value: aws.String(az),
							},
						},
						Unit: cwtypes.StandardUnitCount,
					})
				}

				// Add total instances metric
				metricData = append(metricData, cwtypes.MetricDatum{
					MetricName: aws.String("TotalHealthyInstances"),
					Value:      aws.Float64(float64(totalInstances)),
					Timestamp:  aws.Time(time.Now()),
					Dimensions: []cwtypes.Dimension{
						{
							Name:  aws.String("AutoScalingGroupName"),
							Value: asg.AutoScalingGroupName,
						},
					},
					Unit: cwtypes.StandardUnitCount,
				})

				fmt.Printf("Total healthy and in-service instances: %d\n", totalInstances)

				// Send metrics to CloudWatch
				err = sendMetricsToCloudWatch(cwClient, metricData)
				if err != nil {
					log.Printf("Error sending metrics for ASG %s: %v\n", *asg.AutoScalingGroupName, err)
				}
			}
		}

		// Monitor RDS clusters
		rdsMetrics, err := analyzeRDSClusters(rdsClient)
		if err != nil {
			log.Printf("Error analyzing RDS clusters: %v", err)
		} else {
			// Print RDS metrics
			for _, metric := range rdsMetrics {
				fmt.Printf("\nRDS Cluster: %s\n", metric.ClusterID)
				fmt.Printf("Instance distribution per AZ:\n")

				for az, counts := range metric.AZCounts {
					fmt.Printf("  %s: %d writer(s), %d reader(s)\n",
						az, counts.Writers, counts.Readers)
				}
			}

			// Send RDS metrics to CloudWatch
			err = sendRDSMetricsToCloudWatch(cwClient, rdsMetrics)
			if err != nil {
				log.Printf("Error sending RDS metrics to CloudWatch: %v", err)
			}
		}

		time.Sleep(time.Duration(pollingInterval) * time.Second)
	}
}

func getASGs(client *autoscaling.Client) ([]asgtypes.AutoScalingGroup, error) {
	// Create the input parameters
	input := &autoscaling.DescribeAutoScalingGroupsInput{}

	// Get all Auto Scaling groups
	result, err := client.DescribeAutoScalingGroups(context.TODO(), input)
	if err != nil {
		log.Fatalf("Unable to describe Auto Scaling groups: %v", err)
	}

	return result.AutoScalingGroups, err
}

// Helper function to check if an instance is both healthy and in service
func isHealthyAndInService(instance asgtypes.Instance) bool {
	return instance.HealthStatus != nil &&
		*instance.HealthStatus == "Healthy" &&
		instance.LifecycleState == "InService"
}

func sendMetricsToCloudWatch(client *cloudwatch.Client, metricData []cwtypes.MetricDatum) error {
	// CloudWatch API can only process 20 metrics at a time
	batchSize := 20
	for i := 0; i < len(metricData); i += batchSize {
		end := i + batchSize
		if end > len(metricData) {
			end = len(metricData)
		}

		input := &cloudwatch.PutMetricDataInput{
			Namespace:  aws.String("CustomAZMetrics"),
			MetricData: metricData[i:end],
		}

		_, err := client.PutMetricData(context.TODO(), input)
		if err != nil {
			return fmt.Errorf("error putting metric data: %v", err)
		}
	}
	return nil
}

func getRDSClusters(client *rds.Client) ([]rdstypes.DBCluster, error) {
	input := &rds.DescribeDBClustersInput{}
	result, err := client.DescribeDBClusters(context.TODO(), input)
	if err != nil {
		return nil, fmt.Errorf("error describing DB clusters: %v", err)
	}
	return result.DBClusters, nil
}

func analyzeRDSClusters(client *rds.Client) ([]RDSClusterMetrics, error) {
	clusters, err := getRDSClusters(client)
	if err != nil {
		return nil, err
	}

	var metrics []RDSClusterMetrics

	for _, cluster := range clusters {
		clusterMetrics := RDSClusterMetrics{
			ClusterID: *cluster.DBClusterIdentifier,
			AZCounts:  make(map[string]RDSInstanceCount),
		}

		// Initialize AZ counts for all AZs in the cluster
		for _, az := range cluster.AvailabilityZones {
			clusterMetrics.AZCounts[az] = RDSInstanceCount{}
		}

		// Count instances per AZ
		for _, instance := range cluster.DBClusterMembers {
			if instance.DBInstanceIdentifier == nil {
				continue
			}

			rdsInstance, err := client.DescribeDBInstances(context.TODO(), &rds.DescribeDBInstancesInput{
				DBInstanceIdentifier: instance.DBInstanceIdentifier,
			})

			if err != nil {
				return nil, err
			}

			az := *rdsInstance.DBInstances[0].AvailabilityZone
			counts := clusterMetrics.AZCounts[az]

			if *instance.IsClusterWriter {
				counts.Writers++
			} else {
				counts.Readers++
			}

			clusterMetrics.AZCounts[az] = counts
		}

		metrics = append(metrics, clusterMetrics)
	}

	return metrics, nil
}

func sendRDSMetricsToCloudWatch(cwClient *cloudwatch.Client, metrics []RDSClusterMetrics) error {
	for _, clusterMetrics := range metrics {
		var metricData []cwtypes.MetricDatum

		// Add metrics for each AZ
		for az, counts := range clusterMetrics.AZCounts {
			// Writer metric
			metricData = append(metricData, cwtypes.MetricDatum{
				MetricName: aws.String("WriterInstancesInAZ"),
				Value:      aws.Float64(float64(counts.Writers)),
				Dimensions: []cwtypes.Dimension{
					{
						Name:  aws.String("DBClusterIdentifier"),
						Value: aws.String(clusterMetrics.ClusterID),
					},
					{
						Name:  aws.String("AvailabilityZone"),
						Value: aws.String(az),
					},
				},
				Unit: cwtypes.StandardUnitCount,
			})

			// Reader metric
			metricData = append(metricData, cwtypes.MetricDatum{
				MetricName: aws.String("ReaderInstancesInAZ"),
				Value:      aws.Float64(float64(counts.Readers)),
				Dimensions: []cwtypes.Dimension{
					{
						Name:  aws.String("DBClusterIdentifier"),
						Value: aws.String(clusterMetrics.ClusterID),
					},
					{
						Name:  aws.String("AvailabilityZone"),
						Value: aws.String(az),
					},
				},
				Unit: cwtypes.StandardUnitCount,
			})
		}

		// Send metrics in batches
		err := sendMetricsToCloudWatch(cwClient, metricData)
		if err != nil {
			return fmt.Errorf("error sending metrics for cluster %s: %v", clusterMetrics.ClusterID, err)
		}
	}

	return nil
}
