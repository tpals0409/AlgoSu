# ADR-002: Outbox Pattern Adoption Review

- **Status**: Deferred
- **Date**: 2026-03-08
- **Decision maker**: Oracle

## Context

The Submission service performs DB storage and RabbitMQ message publication sequentially when processing submissions.
These two operations are not atomic — if MQ publication fails after DB commit, data inconsistency can occur.

**Current flow:**
1. Save Submission to DB (commit)
2. Publish analysis request message to RabbitMQ
3. Publish push request message to GitHub Worker

**Risk scenarios:**
- 1 success + 2 failure: Submission saved but AI analysis never starts
- 1 success + 3 failure: Submission saved but GitHub push never executes

## Current Compensating Controls (Applied in Sprint 43 W2)

- **Optimistic lock**: Prevents Lost Update via version column on Saga state changes
- **Timeout resume**: cron detects incomplete Sagas within a time window and restarts them
- **Idempotency check**: Each worker detects duplicate messages and prevents reprocessing (idempotency key)

These controls ensure eventual consistency even in the event of message loss, via timeout resume.

## Options Under Review

### Option A: Outbox Table + Polling Publisher

Store messages together in the Outbox table within the DB transaction; a separate Polling Publisher periodically reads the Outbox and publishes to MQ.

**Pros:**
- Guarantees atomicity of DB storage and message publication
- Eliminates possibility of message loss

**Cons:**
- Additional operational overhead of Outbox table + Polling service
- Increased processing latency due to polling delay
- Additional resource consumption on single OCI ARM instance

### Option B: CDC (Change Data Capture, Debezium, etc.)

Captures PostgreSQL WAL and automatically publishes change events to MQ.

**Pros:**
- Minimal application code changes
- Near-real-time event propagation

**Cons:**
- Requires Debezium + Kafka Connect infrastructure (resource-heavy)
- Operationally unrealistic on OCI ARM 4 OCPU / 24GB environment
- Significantly increases operational complexity

### Option C: Keep Current + Compensate (Currently Adopted)

Retain the optimistic lock + timeout resume + idempotency check applied in Sprint 43 W2.

**Pros:**
- No additional infrastructure needed
- Sufficient stability at current traffic levels
- Minimal operational complexity

**Cons:**
- Theoretical message loss possibility exists (recoverable via timeout resume)
- Timeout resume load may increase under traffic spikes

## Decision

**Option C (keep current + compensate) adopted.**

Rationale:
1. Resources are insufficient to operate additional Outbox Polling or CDC infrastructure on a single OCI ARM instance (4 OCPU / 24GB).
2. At current traffic levels (study group scale, dozens of concurrent users), the actual probability of a failure caused by DB-MQ non-atomicity is extremely low.
3. The timeout resume mechanism automatically recovers lost messages, ensuring eventual consistency.

## Re-evaluation Triggers

Re-evaluate introduction of Option A (Outbox Pattern) if any of the following conditions are met:
- 500+ concurrent users or 1,000+ daily submissions
- 10+ duplicate processing events per month caused by timeout resume
- Infrastructure scale-up (e.g., multi-node migration) providing resource headroom
