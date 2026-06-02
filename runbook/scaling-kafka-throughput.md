# Scaling Kafka Throughput

## During Live Events

VenueIQ processes up to 50,000 POS transactions/minute during peak events.

## Monitoring Consumer Lag

```bash
# Check lag across all consumer groups
kubectl exec -n venueiq-services deployment/concessions-service -- \
  kafka-consumer-groups \
    --bootstrap-server $KAFKA_BROKERS \
    --describe \
    --all-groups \
    2>/dev/null | awk '$6 > 1000 {print $0}'
```

If lag > 10,000 messages on any partition:

1. Scale the consuming service: `kubectl scale deployment {service} -n venueiq-services --replicas=8`
2. Add partitions to the topic (cannot reduce partitions): Contact AWS MSK team
3. Investigate slow consumer: check DB write latency

## MSK Broker Scaling

During sustained high-load events, scale MSK broker instance type via Terraform:
```hcl
# In infrastructure/terraform/msk.tf
instance_type = "kafka.m5.2xlarge"  # Upgrade from m5.xlarge
```

Apply: `terraform apply -target=aws_msk_cluster.venueiq`

## Kafka Topics Sizing

| Topic                          | Partitions | Consumers |
|-------------------------------|------------|-----------|
| venueiq.pos.transactions       | 12         | 4 per service |
| venueiq.security.gate_scans    | 6          | 2 per service |
| venueiq.analytics.kpi_snapshots| 6          | 2 |
| venueiq.agents.outputs         | 3          | 1 |
