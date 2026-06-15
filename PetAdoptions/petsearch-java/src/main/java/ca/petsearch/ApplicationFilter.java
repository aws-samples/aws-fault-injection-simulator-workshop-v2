package ca.petsearch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

import static net.logstash.logback.argument.StructuredArguments.kv;

public class ApplicationFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(ApplicationFilter.class);

    private final MetricEmitter metricEmitter;

    public ApplicationFilter(MetricEmitter metricEmitter) {
        this.metricEmitter = metricEmitter;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {

        long requestStartTime = System.currentTimeMillis();

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper((HttpServletResponse) response);

        String path = ((HttpServletRequest) request).getServletPath();
        String errMsg = "";

        try {
            chain.doFilter(request, responseWrapper);
        } catch (IOException | ServletException | RuntimeException e) {
            // Record the failure on the request line, then re-throw so request
            // handling is unchanged (the log call below still runs in finally).
            errMsg = e.getClass().getSimpleName() + ": " + e.getMessage();
            throw e;
        } finally {
            int loadSize = responseWrapper.getContentSize();

            responseWrapper.copyBodyToResponse();

            int status = ((HttpServletResponse) response).getStatus();
            String statusCode = String.valueOf(status);
            long latencyMs = System.currentTimeMillis() - requestStartTime;

            metricEmitter.emitReturnTimeMetric(latencyMs, path, statusCode);

            metricEmitter.emitBytesSentMetric(loadSize, path, statusCode);

            // Per-request structured log line. Each kv(...) pair is emitted as a
            // top-level JSON field by logstash-logback-encoder, so service / az /
            // instance / status / latency_ms are visible to CloudWatch Contributor
            // Insights and the per-AZ latency dashboard during FIS experiments
            // (e.g. AZ latency slowdown, instance termination). Context comes from
            // RuntimeContext (resolved at startup) rather than MDC, because the
            // OTel Java agent does not preserve start-time MDC values.
            logger.info("request",
                    kv("service", RuntimeContext.SERVICE),
                    kv("az", RuntimeContext.AVAILABILITY_ZONE),
                    kv("instance", RuntimeContext.INSTANCE),
                    kv("node", RuntimeContext.NODE),
                    kv("path", path),
                    kv("status", status),
                    kv("latency_ms", latencyMs),
                    kv("bytes", loadSize),
                    kv("err", errMsg));
        }
    }
}
