package ca.petsearch;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Resolves where this service instance runs (service name, Availability Zone,
 * host/instance) once at startup, so request log lines can be attributed to a
 * specific service + AZ + host during FIS experiments (e.g. AZ latency
 * slowdown). Values are included directly on each log line rather than via MDC,
 * because the OpenTelemetry Java agent manages MDC per-request and does not
 * preserve MDC values set at process start.
 *
 * All lookups are best-effort and never throw, so a metadata outage can never
 * affect request handling.
 */
public final class RuntimeContext {

    public static final String SERVICE = envOrDefault("SERVICE_NAME", "petsearch");
    public static final String NODE = envOrDefault("NODE_NAME", "");
    public static final String INSTANCE = firstNonEmpty(System.getenv("POD_NAME"), System.getenv("HOSTNAME"));
    public static final String AVAILABILITY_ZONE = resolveAvailabilityZone();

    private RuntimeContext() { }

    private static String resolveAvailabilityZone() {
        String az = System.getenv("AWS_AVAILABILITY_ZONE");
        if (az != null && !az.isEmpty()) return az;
        // ECS resolves AZ from the Task Metadata v4 endpoint. Short timeout so a
        // metadata outage can never block or crash startup.
        try {
            String uri = System.getenv("ECS_CONTAINER_METADATA_URI_V4");
            if (uri == null || uri.isEmpty()) return "";
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
            HttpRequest req = HttpRequest.newBuilder(URI.create(uri + "/task"))
                    .timeout(Duration.ofSeconds(2)).GET().build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            String body = resp.body();
            int i = body.indexOf("\"AvailabilityZone\"");
            if (i >= 0) {
                int c = body.indexOf(':', i);
                int q1 = body.indexOf('"', c + 1);
                int q2 = body.indexOf('"', q1 + 1);
                if (q1 >= 0 && q2 > q1) return body.substring(q1 + 1, q2);
            }
        } catch (Exception e) {
            // best-effort
        }
        return "";
    }

    private static String envOrDefault(String key, String def) {
        String v = System.getenv(key);
        return (v == null || v.isEmpty()) ? def : v;
    }

    private static String firstNonEmpty(String... vals) {
        for (String v : vals) if (v != null && !v.isEmpty()) return v;
        return "";
    }
}
