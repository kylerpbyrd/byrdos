# Scalability

byrdOS is built for the first integration (Varo Bank via Plaid), but every architectural decision is chosen to support future scale without major refactoring. This document describes the scaling path for workers, analytics, API, events, and encryption.

This document inherits ADR-0000 §4 (modular architecture) and §5 (provider-agnostic integrations).

## Current scale assumptions

- 1,000–10,000 users in year one.
- Sync every 4 hours per active connection.
- Thousands of transactions per user per year.
- Current stack (Postgres, Redis, BullMQ) handles this comfortably.

## Splitting workers by resource type

Currently, `services/sync-worker` handles accounts, transactions, and classification. As load grows, workers split by resource type:

- `services/accounts-worker`
- `services/transactions-worker`
- `services/classify-worker`

Each worker has its own queue and concurrency settings. They share the same NestJS DI modules from `packages/*`.

## Analytics at scale

When transaction volume exceeds ~50 million rows, analytical queries move from PostgreSQL to a columnar store.

| Stage | Store | Use case |
|---|---|---|
| Current | PostgreSQL + indexes | OLTP and small analytics |
| 50M+ transactions | ClickHouse or BigQuery | Aggregations, trends, reports |
| Event sourcing | Redis Streams → Kafka/NATS | Real-time event processing |

Analytical data is populated asynchronously from domain events.

## API gateway

As the surface area grows, `apps/api` may evolve into a gateway pattern:

- `gateway` handles auth, routing, rate limiting.
- Domain services become independent deployable units behind the gateway.
- GraphQL or tRPC may be introduced for frontend efficiency if REST becomes chatty.

## Event broker upgrade

Redis Streams is sufficient for early scale. At ~1,000 events per second sustained, consider NATS or Kafka:

| Broker | When | Reason |
|---|---|---|
| Redis Streams | Now – 1k events/sec | Simple, already in stack |
| NATS JetStream | 1k+ events/sec | Lightweight, ordered streams |
| Kafka | 10k+ events/sec, multiple teams | Ecosystem, partitioning |

The outbox pattern in PostgreSQL stays the same; only the relay target changes.

## Database scaling

- **Read replicas**: Offload read-heavy dashboards.
- **Connection pooling**: PgBouncer or provider-native pooling.
- **Sharding**: By `userId` if a single Postgres instance is exhausted.
- **Archival**: Move old raw provider payloads and audit logs to cold storage.

## Field-level encryption

Currently, credentials are encrypted. At higher compliance requirements, field-level encryption may use an HSM or cloud KMS:

- Per-user encryption keys.
- Key rotation policies.
- Audit of every decrypt operation.

## Caching tier

As read load grows, Redis caching expands:

- Cache pre-aggregated dashboard data.
- Use Redis Cluster for high availability.
- Consider CDN caching for static assets and public API responses.

## Provider fanout

When multiple providers are integrated, provider-specific queues can be split to prevent one provider's outage from blocking others:

- `transactions:plaid`
- `transactions:mx`
- `transactions:akoya`

## Observability at scale

- Sampling for high-volume traces.
- Metrics aggregation at the edge.
- Structured log shipping to a central store.
- Alerting based on SLOs defined before each milestone exits M-Stage.

## Consequences

- **Positive**: Modular architecture makes scaling decisions local.
- **Positive**: Outbox pattern lets the event broker change without rewriting producers.
- **Negative**: Early over-engineering is avoided, but migration planning must start before limits are hit.
- **Negative**: Multi-region deployments introduce consistency tradeoffs.
