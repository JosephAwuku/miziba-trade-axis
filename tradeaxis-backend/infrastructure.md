# TRADEAXIS — INFRASTRUCTURE SPECIFICATION
Miziba Infrastructure Ltd | Module 4
Production Environment | AWS (recommended) or GCP

---

## 1. ARCHITECTURE OVERVIEW

```
Internet
    │
    ▼
CloudFront CDN (static assets + API caching for GET endpoints)
    │
    ▼
Application Load Balancer (HTTPS, SSL termination)
    │
    ├── /api/*  →  ECS Fargate (Node.js API, 2 tasks min)
    │
    └── /* (static)  →  S3 + CloudFront (React/HTML dashboard)

ECS Fargate API
    │
    ├── RDS PostgreSQL 15 (primary + read replica)
    ├── ElastiCache Redis (sessions, notification queue)
    ├── S3 (document storage, FDP PDFs, CCC files)
    ├── SES (email notifications)
    ├── SNS/SQS (async notification queue)
    └── Secrets Manager (DB creds, JWT secret, HMAC keys)

External Integrations (outbound from API)
    ├── TradeVault API (waterfall instructions)
    ├── TrackGuard API (shipment status poll + webhook receipt)
    ├── DocuSign (term sheet e-signature)
    └── SendGrid or SES (email delivery)
```

---

## 2. SERVICES SPECIFICATION

### 2.1 Compute — API Server

| Property | Specification |
|----------|---------------|
| Service | AWS ECS Fargate |
| Runtime | Node.js 20 LTS |
| Framework | Express.js 4.x |
| Min tasks | 2 (HA across 2 AZs) |
| Max tasks | 10 (auto-scale) |
| CPU | 512 vCPU per task |
| Memory | 1024 MB per task |
| Scale trigger | CPU > 70% for 3 minutes |
| Health check | GET /health → 200 |
| Deployment | Rolling update, min healthy 50% |

**Environment variables (via Secrets Manager):**
```
DATABASE_URL          postgresql://...
REDIS_URL             redis://...
JWT_SECRET            <256-bit random>
TRADEVAULT_WEBHOOK_SECRET   <HMAC key from TradeVault>
TRACKGUARD_WEBHOOK_SECRET   <HMAC key from TrackGuard>
TRADEVAULT_API_KEY    <TradeVault API key>
TRACKGUARD_API_KEY    <TrackGuard API key>
DOCUSIGN_ACCOUNT_ID   <DocuSign>
DOCUSIGN_PRIVATE_KEY  <RSA private key for JWT grant>
AWS_S3_BUCKET         miziba-tradeaxis-docs
AWS_SES_FROM          noreply@tradeaxis.miziba.com
SENDGRID_API_KEY      <optional, if using SendGrid>
PORT                  3000
NODE_ENV              production
```

### 2.2 Database — PostgreSQL

| Property | Specification |
|----------|---------------|
| Service | AWS RDS PostgreSQL 15 |
| Instance class | db.t3.medium (scale to db.r6g.large at Series B) |
| Multi-AZ | Yes — synchronous standby in second AZ |
| Read replica | 1 replica for portfolio dashboard reads |
| Storage | 100 GB gp3, autoscale to 500 GB |
| Backup | Automated daily snapshots, 30-day retention |
| Encryption | AES-256 at rest |
| Connection pooling | PgBouncer sidecar in ECS (transaction mode) |
| Max connections | 100 (pooled) |
| SSL | Required (verify-full) |

**Connection string format:**
```
postgresql://tradeaxis_app:<password>@<rds-endpoint>:5432/tradeaxis?sslmode=verify-full
```

**Separate read replica endpoint for:**
- GET /portfolio
- GET /portfolio/buyers
- GET /portfolio/finance-partners
- GET /portfolio/risk-evolution/:id

### 2.3 Cache — Redis

| Property | Specification |
|----------|---------------|
| Service | AWS ElastiCache Redis 7.x |
| Instance | cache.t3.micro |
| Cluster mode | Off (single-node for launch, cluster at scale) |
| Use cases | Session store · Notification dedup · Rate limiting · FDP cache |

**Cache keys:**
```
session:<token_hash>       TTL: 8h
fdp:<trade_id>             TTL: 1h (invalidated on FDP regeneration)
portfolio_metrics          TTL: 5min
rate_limit:<ip>:<route>    TTL: 60s
```

### 2.4 Storage — S3

| Bucket | Purpose | Access |
|--------|---------|--------|
| miziba-tradeaxis-docs | All trade documents, FDP PDFs, CCCs | Private. Pre-signed URLs only. |
| miziba-tradeaxis-static | Dashboard HTML/JS/CSS | Public read via CloudFront |
| miziba-tradeaxis-logs | ALB + API access logs | Private |

**S3 key naming convention (documents):**
```
trades/{trade_id}/documents/{doc_type}/{timestamp}_{filename}
trades/{trade_id}/fdp/v{version}/fdp_{trade_ref}.pdf
trades/{trade_id}/ccc/{ccc_ref}.pdf
```

**Lifecycle rules:**
- All objects: transition to S3 Glacier after 2 years
- Deletion rule: NEVER (7-year retention enforced; no expiry lifecycle)
- Versioning: ENABLED on miziba-tradeaxis-docs

**Pre-signed URL TTL:**
- Download: 15 minutes
- Upload: 5 minutes

### 2.5 Email / Notifications

**Primary: AWS SES**
- Verified domain: tradeaxis.miziba.com
- DKIM + SPF + DMARC configured
- From address: noreply@tradeaxis.miziba.com
- Reply-to: ops@miziba.com
- Bounce/complaint handling via SES SNS notifications

**Async queue: SQS**
- Queue: tradeaxis-notifications
- Visibility timeout: 30s
- Message retention: 4 days
- Dead letter queue: tradeaxis-notifications-dlq (max 3 retries)

**Worker:** Separate ECS task polling SQS for notifications. Processes email + in_app + SMS (Twilio, optional at launch).

### 2.6 PDF Generation

**Service:** Dedicated ECS task (not inline in API)

**Stack:** Node.js + Puppeteer headless Chrome

**Flow:**
1. API queues FDP PDF generation job in SQS: `tradeaxis-pdf-jobs`
2. PDF worker picks up job
3. Renders FDP HTML template → PDF via Puppeteer
4. Uploads PDF to S3
5. Updates `finance_data_packages.pdf_s3_key` in database
6. Pushes in-app notification to requester

**Target:** PDF generation < 15 seconds from queue pick-up (as specified in NFRs)

**Alternative (simpler):** WeasyPrint (Python) — use if Puppeteer proves heavy. Same queue-based pattern.

### 2.7 DocuSign Integration

**Use case:** Term sheet e-signature execution

**Flow:**
1. API generates term sheet PDF from template
2. Creates DocuSign envelope via REST API
3. Sends envelope to: Finance Partner signatory + Trader + Miziba CEO
4. DocuSign webhook fires `envelope.completed` when all signed
5. TradeAxis webhook endpoint stores executed PDF in S3
6. Trade document record updated to ACCEPTED

**DocuSign auth:** JWT Grant flow (no user redirect required)

**Environment:** DocuSign sandbox → production promotion after UAT

---

## 3. SECURITY

### 3.1 Authentication
- JWT tokens, 8-hour expiry, rotated on activity
- 2FA (TOTP via Google Authenticator) — mandatory for ceo, cfo roles
- Sessions stored in Redis + PostgreSQL (dual validation)
- Brute-force protection: 5 failed logins → 15-minute IP lockout (Redis rate limiter)

### 3.1 Pre-Launch Security Requirements
- Annual penetration test by certified external firm (CREST or equivalent) — **required before any finance partner capital is deposited** (per spec §Security)
- Scope: API endpoints, authentication, 2FA bypass attempts, payment flow, audit log integrity, HMAC signature validation
- Findings must be remediated before go-live

### 3.2 API Security
- All endpoints HTTPS only (TLS 1.2+)
- CORS: whitelist miziba.com subdomains only
- Rate limiting: 100 req/min per IP (general), 10 req/min for auth endpoints
- Input validation: Joi schema on all request bodies
- SQL injection: parameterised queries only (no raw string concatenation)
- XSS: all user content sanitised before storage

### 3.3 Data Encryption
- At rest: AES-256 (RDS, S3 server-side encryption)
- In transit: TLS 1.2+ enforced
- Sensitive fields (bank account numbers): pgcrypto column-level encryption
- Secrets: AWS Secrets Manager (no env vars with secrets in code)

### 3.4 Webhook Security
- HMAC-SHA256 signature validation on all inbound webhooks
- Secrets stored in Secrets Manager, not hardcoded
- Replay attack protection: reject events older than 5 minutes
- IP allowlisting for TradeVault and TrackGuard IPs (WAF rule)

### 3.5 Document Access
- All documents: private S3 objects
- Access via pre-signed URLs with 15-minute TTL only
- Every access logged to `document_access_log`
- Role-gated: user must be associated with the trade to receive URL

---

## 4. MONITORING & ALERTING

### 4.1 Application Monitoring
**Service:** AWS CloudWatch + optional Datadog

**Key metrics:**
| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 latency | > 400ms | > 1s |
| Error rate (5xx) | > 1% | > 5% |
| PDF gen time | > 15s | > 30s |
| DB connection pool | > 80% | > 95% |
| Webhook processing lag | > 30s | > 60s |

**Alarms → SNS → ops@miziba.com + Slack #tradeaxis-alerts**

### 4.2 Uptime
- Target: 99.5% (as per NFRs)
- Multi-AZ ECS + RDS covers single-AZ failure
- ALB health checks every 10s
- On-call alert if portal unavailable > 15min during business hours (06:00–22:00 GMT)

### 4.3 Structured Logging
- All API requests logged: method, path, status, latency, user_id, trade_id
- All errors logged with stack trace
- Log format: JSON (CloudWatch Logs Insights compatible)
- Retention: 90 days in CloudWatch, archived to S3 indefinitely

---

## 5. CI/CD PIPELINE

**Platform:** GitHub Actions

```yaml
# .github/workflows/deploy.yml (outline)
on:
  push:
    branches: [main]       # Production deploy
  push:
    branches: [develop]    # Staging deploy

jobs:
  test:
    - npm ci
    - npm run lint
    - npm run test          # Jest unit + integration tests
    - npm run test:e2e      # Supertest API tests

  build:
    - docker build -t tradeaxis-api .
    - docker push ECR

  deploy-staging:
    - ecs update-service --cluster staging --service tradeaxis-api
    - run db:migrate on staging
    - smoke test

  deploy-production:
    - ecs update-service --cluster production --service tradeaxis-api
    - run db:migrate on production (with rollback plan)
    - smoke test
    - notify Slack
```

**Database migrations:** node-pg-migrate (sequential numbered migrations, never destructive)

---

## 6. DISASTER RECOVERY

| Scenario | Recovery | RPO | RTO |
|----------|----------|-----|-----|
| Single AZ failure | RDS Multi-AZ auto-failover, ECS reschedules | 0 (sync) | < 5min |
| Database corruption | Restore from automated snapshot | 24h | < 2h |
| Accidental data deletion | Point-in-time recovery (RDS PITR) | < 5min | < 1h |
| Full region failure | Manual restore to secondary region | 24h | 4h |

**Backup testing:** Monthly snapshot restore drill to confirm RTO is achievable.

---

## 7. COST ESTIMATE (Launch Phase)

| Service | Spec | Est. USD/month |
|---------|------|---------------|
| ECS Fargate (2 tasks) | 0.5 vCPU, 1GB each | ~$30 |
| RDS PostgreSQL | db.t3.medium Multi-AZ | ~$120 |
| ElastiCache Redis | cache.t3.micro | ~$25 |
| S3 (docs + static) | 50GB + transfer | ~$5 |
| ALB | Standard | ~$20 |
| CloudFront | 100GB transfer | ~$10 |
| SES | 10,000 emails/mo | ~$1 |
| Secrets Manager | 10 secrets | ~$5 |
| CloudWatch | Logs + metrics | ~$15 |
| **Total estimate** | | **~$231/month** |

*Excludes DocuSign (from $250/month) and Twilio SMS (if enabled).*
*Scale to ~$600/month at Series A volume.*

---

## 8. DOMAIN & SSL

- Region: `af-south-1` (AWS Lagos) — required for Ghana Data Protection Act compliance. Financial data must remain in Africa.
- DR backup: `af-south-1` (Frankfurt) — data residency acceptable for backup per GH-DPA guidance.
- API: `api.tradeaxis.miziba.com`
- Dashboard: `tradeaxis.miziba.com`
- Webhooks: `api.tradeaxis.miziba.com/webhooks/tradevault` etc.
- SSL: AWS Certificate Manager (ACM) — auto-renewed
- DNS: Route 53

---

## 9. LAUNCH CHECKLIST

- [ ] RDS instance provisioned + schema applied (`schema.sql`)
- [ ] ECS cluster and task definitions created
- [ ] Secrets Manager secrets populated
- [ ] S3 buckets created with lifecycle rules and versioning
- [ ] SES domain verified + DKIM configured
- [ ] SQS queues created (notifications, pdf-jobs, DLQs)
- [ ] ACM certificate issued for `*.miziba.com`
- [ ] CloudFront distributions configured
- [ ] WAF rules applied (rate limiting, geo, IP allowlist for webhooks)
- [ ] Webhook HMAC secrets shared with TradeVault and TrackGuard
- [ ] DocuSign sandbox tested + production account activated
- [ ] S3 Object Lock (WORM) enabled on audit log backup bucket (7-year immutability, per spec §Security)
- [ ] Daily audit log integrity hash job configured (CloudWatch cron → Lambda)
- [ ] Smoke tests passing on staging
- [ ] Load test: 20 concurrent FP portal sessions (per NFR)
- [ ] DR test: snapshot restore confirmed
- [ ] Monitoring alarms active + on-call configured
- [ ] All Secrets Manager values confirmed (no defaults)
- [ ] CEO sign-off on staging UAT
