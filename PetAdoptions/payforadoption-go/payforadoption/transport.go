package payforadoption

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/aws/aws-xray-sdk-go/xray"
	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/transport"
	httptransport "github.com/go-kit/kit/transport/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func MakeHTTPHandler(s Service, logger log.Logger) http.Handler {
	r := mux.NewRouter()
	e := MakeEndpoints(s)
	options := []httptransport.ServerOption{
		httptransport.ServerErrorHandler(transport.NewLogErrorHandler(logger)),
		httptransport.ServerErrorEncoder(encodeError),
		httptransport.ServerBefore(func(ctx context.Context, r *http.Request) context.Context {
			return context.WithValue(ctx, ctxKeyStart{}, time.Now())
		}),
		httptransport.ServerFinalizer(makeLoggingFinalizer(logger)),
	}

	r.Methods("GET").Path("/health/status").Handler(httptransport.NewServer(
		e.HealthCheckEndpoint,
		decodeEmptyRequest,
		encodeEmptyResponse,
		options...,
	))

	// using xray as wrapper for http.Handler
	r.Methods("POST").Path("/api/home/completeadoption").Handler(
		xray.Handler(
			xray.NewFixedSegmentNamer("payforadoption"),
			httptransport.NewServer(
				e.CompleteAdoptionEndpoint,
				decodeCompleteAdoptionRequest,
				encodeResponse,
				options...,
			),
		),
	)
	// using xray as wrapper for http.Handler
	r.Methods("POST").Path("/api/home/cleanupadoptions").Handler(
		xray.Handler(
			xray.NewFixedSegmentNamer("payforadoption"),
			httptransport.NewServer(
				e.CleanupAdoptionsEndpoint,
				decodeEmptyRequest,
				encodeEmptyResponse,
				options...,
			),
		),
	)

	// Trigger DDB seeding
	r.Methods("POST").Path("/api/home/triggerseeding").Handler(httptransport.NewServer(
		e.TriggerSeedingEndpoint,
		decodeEmptyRequest,
		encodeEmptyResponse,
		options...,
	))

	r.Methods("GET").Path("/metrics").Handler(promhttp.Handler())

	return r
}

type errorer interface {
	error() error
}

type completeAdoptionRequest struct {
	PetId   string `json:"petid"`
	PetType string `json:"pettype"`
}

var (
	ErrNotFound   = errors.New("not found")
	ErrBadRequest = errors.New("Bad request parameters")
)

func decodeEmptyRequest(_ context.Context, r *http.Request) (interface{}, error) {
	return nil, nil
}

func decodeCompleteAdoptionRequest(_ context.Context, r *http.Request) (interface{}, error) {

	petId := r.URL.Query().Get("petId")
	petType := r.URL.Query().Get("petType")

	if petId == "" || petType == "" {
		return nil, ErrBadRequest
	}

	return completeAdoptionRequest{petId, petType}, nil
}

func encodeResponse(ctx context.Context, w http.ResponseWriter, response interface{}) error {
	if e, ok := response.(errorer); ok && e.error() != nil {
		encodeError(ctx, e.error(), w)
		return nil
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	return json.NewEncoder(w).Encode(response)
}

func encodeEmptyResponse(ctx context.Context, w http.ResponseWriter, response interface{}) error {
	if e, ok := response.(errorer); ok && e.error() != nil {
		encodeError(ctx, e.error(), w)
		return nil
	}
	return nil
}

func encodeError(_ context.Context, err error, w http.ResponseWriter) {
	if err == nil {
		panic("encodeError with nil error")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(codeFrom(err))
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": err.Error(),
	})
}

func codeFrom(err error) int {
	switch err {
	case ErrNotFound:
		return http.StatusNotFound
	case ErrBadRequest:
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// ctxKeyStart carries the request-start time from ServerBefore to the
// finalizer so per-request latency can be computed.
type ctxKeyStart struct{}

// makeLoggingFinalizer returns a go-kit ServerFinalizer that emits one
// top-level JSON line per request. The logger passed in is the base logger
// from main.go, already enriched with service / az / instance via
// log.With(...LogKeyvals()...), so those fields appear on the line for free.
// Emitting through the JSON logger (not fmt.Println) makes status / path /
// latency_ms top-level fields visible to CloudWatch Contributor Insights and
// the per-AZ latency dashboard during FIS experiments.
func makeLoggingFinalizer(logger log.Logger) httptransport.ServerFinalizerFunc {
	return func(ctx context.Context, code int, r *http.Request) {
		var latencyMs int64
		if t, ok := ctx.Value(ctxKeyStart{}).(time.Time); ok {
			latencyMs = time.Since(t).Milliseconds()
		}
		// The finalizer receives only the response status code, not the handler
		// error, so the error signal is status>=500 (err kept "" for field
		// parity with the other services; per-method error detail is still
		// logged separately via level.Error in the service layer).
		_ = logger.Log(
			"event", "request",
			"path", r.URL.Path,
			"status", code,
			"latency_ms", latencyMs,
			"err", "",
		)
	}
}
