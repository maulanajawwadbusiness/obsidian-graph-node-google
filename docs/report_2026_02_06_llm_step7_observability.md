# Report: Step 7 - LLM Observability

Date: 2026-02-06
Scope: Add request lifecycle metrics, structured logs, request_id propagation, and counters for LLM endpoints.

## Summary
Implemented JSON structured logging for all /api/llm/* endpoints with request_id, input/output sizes, timing, and termination reason. Added time-to-first-token for streaming. Added in-memory counters for total, inflight, and streaming requests with periodic logging. Request_id is now attached to response headers and error bodies.

## Metrics Logged (per request)
- request_id
- endpoint
- user_id
- model
- input_chars
- output_chars (best effort)
- duration_ms
- time_to_first_token_ms (stream only)
- status_code
- termination_reason (success, client_abort, timeout, validation_error, rate_limited, upstream_error)

## Sample Log Line (redacted)
```
{"request_id":"<id>","endpoint":"/api/llm/chat","user_id":"<user>","model":"gpt-5.1","input_chars":512,"output_chars":2380,"duration_ms":1240,"time_to_first_token_ms":210,"status_code":200,"termination_reason":"success"}
```

## Counters
- llm_requests_total
- llm_requests_inflight
- llm_requests_streaming

Counters are logged every 60 seconds as a JSON line.

## Debugging Guide
- Slow requests: filter logs with high duration_ms.
- Frequent aborts: filter termination_reason=client_abort and compare time_to_first_token_ms.
- Rate limit hits: filter termination_reason=rate_limited.
- Timeouts: filter termination_reason=timeout and status_code=504.

## Verification Checklist (documented)
- Non-stream request logs duration_ms and output_chars.
- Streaming request logs time_to_first_token_ms.
- Client abort logs termination_reason=client_abort and releases concurrency slot.
- Validation error logs termination_reason=validation_error.
- Timeout logs termination_reason=timeout.

End of report.
