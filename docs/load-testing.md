# Load testing

No representative 500-connection benchmark has run. Before claiming capacity, run progressive 50/100/250/500 WebSocket scenarios against PostgreSQL plus production-like Redis, recording CPU, RSS, event-loop lag, p95 latency, message throughput, disconnects and database/Redis latency. SQLite results may validate functionality only.
