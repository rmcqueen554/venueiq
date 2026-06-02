# Incident Response Runbook

## Step 1: Assess Severity

```bash
# Check all service health
kubectl get pods -n venueiq-services
kubectl get hpa -n venueiq-services

# Check recent errors
kubectl logs -n venueiq-services deployment/tenant-service --since=5m | grep ERROR
```

## Step 2: Check Datadog

1. Open Datadog APM → Services → filter by P99 latency spikes
2. Check infrastructure metrics for CPU/memory spikes
3. Review custom business metrics: active_tenants, kafka_lag, agent_run_rate

## Step 3: Kafka Consumer Lag (common issue during live events)

```bash
# Check consumer group lag
kubectl exec -n venueiq-services deployment/tenant-service -- \
  kafka-consumer-groups --bootstrap-server $KAFKA_BROKERS \
  --describe --group venueiq-concessions

# If lag > 10,000: scale up the affected service
kubectl scale deployment concessions-service -n venueiq-services --replicas=6
```

## Step 4: Database Issues

```bash
# Check slow queries in RDS
# Navigate to: RDS → venueiq-{service} → Performance Insights

# Force connection pool reset
kubectl rollout restart deployment/{service}-service -n venueiq-services
```

## Step 5: Rollback

```bash
# Roll back to previous image
kubectl rollout undo deployment/{service}-service -n venueiq-services

# Verify rollback
kubectl rollout status deployment/{service}-service -n venueiq-services
```

## Step 6: Communicate

1. Update status page (if applicable)
2. Notify affected tenants via email if >15 minutes of degradation
3. Post incident report in ACG Slack #venueiq-incidents within 24 hours
