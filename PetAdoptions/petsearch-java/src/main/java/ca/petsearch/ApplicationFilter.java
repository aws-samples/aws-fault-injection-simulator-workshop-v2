package ca.petsearch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

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

        chain.doFilter(request, responseWrapper);

        int loadSize = responseWrapper.getContentSize();

        responseWrapper.copyBodyToResponse();

        String statusCode = String.valueOf(((HttpServletResponse)response).getStatus());
        String path = ((HttpServletRequest)request).getServletPath();
        long latencyMs = System.currentTimeMillis() - requestStartTime;

        metricEmitter.emitReturnTimeMetric(latencyMs, path, statusCode);

        metricEmitter.emitBytesSentMetric(loadSize, path, statusCode);

        // Per-request structured log line. The service/az/instance context is
        // attached to every log line via MDC (see RuntimeContext), so this also
        // makes request latency queryable during FIS latency experiments.
        logger.info("request path={} status={} latency_ms={} bytes={}", path, statusCode, latencyMs, loadSize);
    }
}
