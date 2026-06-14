using System;
using System.Net.Http;
using System.Text.Json;

namespace PetSite
{
    // Describes where this PetSite instance is running. Used to enrich request
    // logs so that, during FIS experiments (AZ power interruption, instance
    // termination, cross-AZ disruption), a failure or latency spike can be
    // attributed to a specific service, Availability Zone and host/node.
    //
    // All lookups are best-effort and wrapped so they can never throw at
    // startup (a deliberate lesson from the IMDS-on-EKS payment bug, where an
    // EC2 metadata call in a controller constructor crashed every request).
    public static class RuntimeContext
    {
        public static readonly string Service =
            FirstNonEmpty(Environment.GetEnvironmentVariable("SERVICE_NAME"), "petsite");

        // On EKS these are injected via the Kubernetes downward API
        // (NODE_NAME / POD_NAME / POD_IP). The node name identifies the EC2
        // instance the AZ/instance experiments target.
        public static readonly string Node =
            FirstNonEmpty(Environment.GetEnvironmentVariable("NODE_NAME"),
                          Environment.GetEnvironmentVariable("HOSTNAME"));

        public static readonly string Instance =
            FirstNonEmpty(Environment.GetEnvironmentVariable("POD_NAME"),
                          Environment.GetEnvironmentVariable("HOSTNAME"));

        public static readonly string AvailabilityZone = ResolveAvailabilityZone();

        private static string ResolveAvailabilityZone()
        {
            var az = Environment.GetEnvironmentVariable("AWS_AVAILABILITY_ZONE");
            if (!string.IsNullOrEmpty(az)) return az;

            // ECS tasks can resolve AZ from the Task Metadata v4 endpoint. This is
            // best-effort with a short timeout so it can never block/crash startup.
            try
            {
                var uri = Environment.GetEnvironmentVariable("ECS_CONTAINER_METADATA_URI_V4");
                if (string.IsNullOrEmpty(uri)) return "";

                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
                var json = client.GetStringAsync($"{uri}/task").GetAwaiter().GetResult();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("AvailabilityZone", out var azEl))
                    return azEl.GetString() ?? "";
            }
            catch
            {
                // ignore — AZ context is best-effort
            }
            return "";
        }

        private static string FirstNonEmpty(params string[] vals)
        {
            foreach (var v in vals)
                if (!string.IsNullOrEmpty(v)) return v;
            return "";
        }
    }
}
