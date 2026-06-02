# Tenant Offboarding

## Steps

1. **Cancel Stripe subscription** (via Stripe Dashboard or API)
2. **Disable tenant access** — set `onboarding_completed_at = null` in tenants DB
3. **Export tenant data** — run data export job to S3 before deletion
4. **Delete Kafka topics** — `venueiq.*` topics for this tenant_id
5. **Archive database records** — move to cold storage S3, then delete from active DBs
6. **Remove S3 data** — delete `{tenant_id}/` prefix from all buckets (after 30-day hold)
7. **Revoke Clerk users** — delete all Clerk users with this tenant_id in metadata
8. **Notify** — send offboarding confirmation email via Postmark

## Data Retention Policy

- Active tenant data: retained in hot databases for subscription duration
- Post-offboarding: archived to S3 Glacier for 90 days
- After 90 days: permanent deletion per data retention policy
- Exception: security incident logs retained 3 years (regulatory requirement)

## Emergency Data Access Request

If tenant requests data export post-offboarding within 30 days, retrieve from S3 archive.
All data exports must be reviewed by ACG legal before delivery.
