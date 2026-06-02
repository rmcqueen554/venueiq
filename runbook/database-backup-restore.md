# Database Backup & Restore

## Automated Backups

All 15 RDS instances have:
- Automated backups: 7-day retention
- Backup window: 03:00–04:00 UTC daily
- Multi-AZ with automatic failover

## Manual Snapshot

```bash
aws rds create-db-snapshot \
  --db-instance-identifier venueiq-tenants-production \
  --db-snapshot-identifier venueiq-tenants-manual-$(date +%Y%m%d) \
  --region us-east-1
```

## Restore from Snapshot

```bash
# Restore to new instance (does not overwrite existing)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier venueiq-tenants-restored \
  --db-snapshot-identifier {snapshot-id} \
  --region us-east-1
```

## Point-in-Time Recovery

```bash
# Restore to any point within retention window
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier venueiq-tenants-production \
  --target-db-instance-identifier venueiq-tenants-pitr \
  --restore-time 2026-06-01T12:00:00Z \
  --region us-east-1
```

## RDS Failover Test

Tested quarterly. Procedure:
1. Trigger manual failover: `aws rds failover-db-cluster ...`
2. Verify all services reconnect within 60 seconds (connection pool retry logic)
3. Confirm no data loss by checking last write timestamp
