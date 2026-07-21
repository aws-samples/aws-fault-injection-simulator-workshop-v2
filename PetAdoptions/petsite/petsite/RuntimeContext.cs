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
                if (!string.IsNullOrEmpty(uri))
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
                    var json = client.GetStringAsync($"{uri}/task").GetAwaiter().GetResult();
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("AvailabilityZone", out var azEl))
                    {
                        var v = azEl.GetString() ?? "";
                        if (!string.IsNullOrEmpty(v)) return v;
                    }
                }
            }
            catch
            {
                // ignore — AZ context is best-effort
            }

            // On EKS IMDS is unreachable from pods, so fall back to the node's
            // topology.kubernetes.io/zone label via the in-cluster Kubernetes API.
            return ResolveAzFromNodeLabel();
        }

        // Reads this pod's node's topology.kubernetes.io/zone label via the
        // in-cluster Kubernetes API (NODE_NAME is injected via the downward API;
        // the pod's ServiceAccount needs RBAC 'get nodes'). Best-effort with a
        // short timeout — returns "" on any failure so ranking falls back to node.
        private static string ResolveAzFromNodeLabel()
        {
            try
            {
                var node = Environment.GetEnvironmentVariable("NODE_NAME");
                var host = Environment.GetEnvironmentVariable("KUBERNETES_SERVICE_HOST");
                if (string.IsNullOrEmpty(node) || string.IsNullOrEmpty(host)) return "";
                var port = FirstNonEmpty(Environment.GetEnvironmentVariable("KUBERNETES_SERVICE_PORT"), "443");

                const string sa = "/var/run/secrets/kubernetes.io/serviceaccount";
                var token = System.IO.File.ReadAllText($"{sa}/token").Trim();

                var handler = new HttpClientHandler();
                var ca = new System.Security.Cryptography.X509Certificates.X509Certificate2($"{sa}/ca.crt");
                handler.ServerCertificateCustomValidationCallback = (msg, cert, chain, errors) =>
                {
                    // Validate the API server cert against the mounted cluster CA only.
                    var custom = new System.Security.Cryptography.X509Certificates.X509Chain();
                    custom.ChainPolicy.TrustMode = System.Security.Cryptography.X509Certificates.X509ChainTrustMode.CustomRootTrust;
                    custom.ChainPolicy.CustomTrustStore.Add(ca);
                    // The EKS cluster CA is internal and publishes no CRL/OCSP endpoint,
                    // so leave revocation checking off (the default Online mode would
                    // fail the build trying to reach a non-existent CRL). Trust is still
                    // pinned to the mounted cluster CA.
                    custom.ChainPolicy.RevocationMode = System.Security.Cryptography.X509Certificates.X509RevocationMode.NoCheck;
                    return cert != null && custom.Build(cert);
                };

                using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(2) };
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                var json = client.GetStringAsync($"https://{host}:{port}/api/v1/nodes/{node}")
                    .GetAwaiter().GetResult();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("metadata", out var meta) &&
                    meta.TryGetProperty("labels", out var labels) &&
                    labels.TryGetProperty("topology.kubernetes.io/zone", out var zoneEl))
                    return zoneEl.GetString() ?? "";
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
