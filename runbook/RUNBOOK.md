# VenueIQ Operations Runbook

**Owner:** Augmentation Consulting Group (ACG)  
**Classification:** Internal Operations  
**Last Updated:** 2026-06-01

## Architecture Overview

VenueIQ is a multi-tenant SaaS platform deployed on AWS (us-east-1 primary, us-west-2 failover).
It runs as a Kubernetes microservices cluster on AWS EKS with 17 services, Apache Kafka for event streaming,
PostgreSQL 16 (TimescaleDB) for each service database, Redis 7 for caching, and AWS Redshift Serverless for analytics.

## Quick Reference

| Component          | Technology         | URL / Endpoint                           |
|--------------------|--------------------|-----------------------------------------|
| Frontend           | React/Vite → S3/CF | https://app.venueiq.com                  |
| API Gateway        | Kong + AWS APIGW   | https://api.venueiq.com                  |
| Realtime           | Socket.io          | https://realtime.venueiq.com             |
| Monitoring         | Datadog            | https://app.datadoghq.com                |
| Logs               | CloudWatch         | AWS Console → CloudWatch → Logs          |
| CI/CD              | GitHub Actions     | ACG GitHub Organization → venueiq repo   |
| Credentials        | Bitwarden          | ACG Bitwarden Organization               |
| Kubernetes         | AWS EKS            | kubectl context: venueiq-production      |

## On-Call Severity Levels

| Level    | Response Time | Examples                                              |
|----------|---------------|-------------------------------------------------------|
| P0       | Immediate     | Platform down, data breach, all tenants affected      |
| P1       | 15 minutes    | Single service down during live event, auth failure   |
| P2       | 1 hour        | AI agents not running, significant latency degradation|
| P3       | Next business | Non-critical feature broken, data latency elevated    |

## Common Runbooks

See individual runbook files:
- [Adding a New Connector](adding-new-connector.md)
- [Retraining ML Models](retraining-ml-models.md)
- [Investigating Agent Errors](investigating-agent-errors.md)
- [Tenant Offboarding](tenant-offboarding.md)
- [Database Backup & Restore](database-backup-restore.md)
- [Scaling Kafka Throughput](scaling-kafka-throughput.md)
- [Incident Response](incident-response.md)

## Emergency Contacts

All credentials and contacts are stored in the ACG Bitwarden Organization under the VenueIQ collection.
Never store credentials in code, environment variables in CI, or personal accounts.
