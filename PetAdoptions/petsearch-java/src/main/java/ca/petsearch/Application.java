package ca.petsearch;

import org.slf4j.MDC;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        // Put service / AZ / instance into the logging MDC so every JSON log line
        // (which already includes MDC) carries the location context. This lets an
        // operator attribute errors/latency to a specific service, AZ and host
        // during FIS experiments (AZ power interruption, instance termination).
        MDC.put("service", envOrDefault("SERVICE_NAME", "petsearch"));
        MDC.put("instance", firstNonEmpty(System.getenv("POD_NAME"), System.getenv("HOSTNAME")));
        MDC.put("node", envOrDefault("NODE_NAME", ""));
        MDC.put("az", resolveAvailabilityZone());

        SpringApplication.run(Application.class, args);
    }

    private static String resolveAvailabilityZone() {
        String az = System.getenv("AWS_AVAILABILITY_ZONE");
        if (az != null && !az.isEmpty()) return az;
        // Best-effort ECS Task Metadata v4 lookup; short timeout so it can never
        // block or crash startup if the endpoint is unavailable.
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
            // ignore — AZ context is best-effort
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
