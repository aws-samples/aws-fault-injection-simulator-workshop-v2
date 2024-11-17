package main

// Structure to hold AZ instance counts
type AZInstanceCount map[string]int

// RDSInstanceCount holds the count of instances per role in an AZ
type RDSInstanceCount struct {
	Writers int
	Readers int
}

// RDSClusterMetrics holds metrics for an RDS cluster
type RDSClusterMetrics struct {
	ClusterID string
	AZCounts  map[string]RDSInstanceCount
}
