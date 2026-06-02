# Retraining ML Models

VenueIQ trains one set of models per venue on their historical data. Models are retrained weekly.

## Trigger Manual Retraining

```bash
# Via BullMQ queue (from tenant-service)
curl -X POST https://api.venueiq.com/api/tenants/{tenant_id}/ml/retrain \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Check Training Status

```bash
# Watch BullMQ dashboard (Redis-based)
# Or check S3 for model artifacts
aws s3 ls s3://venueiq-ml-data/{tenant_id}/models/ --region us-east-1
```

## Model Performance Benchmarks (must be maintained)

| Model                    | Metric | Target  |
|--------------------------|--------|---------|
| Attendance forecast       | MAPE   | ≤ 8%    |
| Demand forecast (per SKU) | MAPE   | ≤ 12%   |
| Dynamic pricing          | Revenue lift | ≥ 3% |
| Predictive maintenance   | Precision@90d | ≥ 75% |
| Season ticket renewal    | AUC-ROC | ≥ 0.82 |
| Crowd flow               | MAE     | ≤ 50 fans |

## Rollback a Model

```bash
# List model versions in S3
aws s3 ls s3://venueiq-ml-data/{tenant_id}/models/attendance_forecast/

# Restore previous version
aws s3 cp s3://venueiq-ml-data/{tenant_id}/models/attendance_forecast/v{N}/ \
          s3://venueiq-ml-data/{tenant_id}/models/attendance_forecast/current/ --recursive
```
