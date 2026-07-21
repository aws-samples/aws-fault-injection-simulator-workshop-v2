package petlistadoptions

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"time"
)

// RuntimeContext describes where this service instance is running. It is used to
// enrich every log line so that, during FIS experiments (AZ power interruption,
// instance termination, cross-AZ disruption), an operator can attribute an error
// or latency spike to a specific service, Availability Zone and host/instance.
type RuntimeContext struct {
	Service          string
	AvailabilityZone string
	Instance         string
	TaskARN          string
}

// taskMetadata is the subset of the ECS Task Metadata v4 response we care about.
type taskMetadata struct {
	AvailabilityZone string `json:"AvailabilityZone"`
	TaskARN          string `json:"TaskARN"`
	ContainerARN     string `json:"ContainerARN"`
}

// LoadRuntimeContext resolves the service name, Availability Zone and host
// identifiers. It never panics and never blocks for long: the ECS Task Metadata
// endpoint lookup is best-effort with a short timeout, so a metadata outage can
// never take the service down (a lesson from the IMDS-on-EKS payment bug).
func LoadRuntimeContext() RuntimeContext {
	rc := RuntimeContext{
		Service:          getenvDefault("SERVICE_NAME", "petlistadoptions"),
		AvailabilityZone: os.Getenv("AWS_AVAILABILITY_ZONE"),
		Instance:         firstNonEmpty(os.Getenv("HOSTNAME"), os.Getenv("HOST_NAME")),
	}

	// On ECS, AZ + task/instance identity come from the Task Metadata v4 endpoint.
	if uri := os.Getenv("ECS_CONTAINER_METADATA_URI_V4"); uri != "" && rc.AvailabilityZone == "" {
		if md, ok := fetchTaskMetadata(uri + "/task"); ok {
			rc.AvailabilityZone = md.AvailabilityZone
			rc.TaskARN = md.TaskARN
			if rc.Instance == "" {
				rc.Instance = md.ContainerARN
			}
		}
	}

	return rc
}

// LogKeyvals returns the runtime context as go-kit log key/value pairs, ready to
// be attached to the base logger with log.With(...).
func (rc RuntimeContext) LogKeyvals() []interface{} {
	return []interface{}{
		"service", rc.Service,
		"az", rc.AvailabilityZone,
		"instance", rc.Instance,
	}
}

func fetchTaskMetadata(url string) (taskMetadata, bool) {
	var md taskMetadata
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return md, false
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return md, false
	}
	if err := json.Unmarshal(body, &md); err != nil {
		return md, false
	}
	return md, true
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
