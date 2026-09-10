# Scalability

SQLite is for local development and functional tests only. Production scale requires PostgreSQL, Redis for cross-instance presence/rate limiting/pubsub where needed, load balancing and measured capacity. No 500-CCU claim is made: map interest management and a production load benchmark are pending.
