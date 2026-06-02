# Adding a New Data Source Connector

## Overview

VenueIQ supports connectors for POS systems, ticketing platforms, parking, security, staffing,
and any custom source via generic webhook. This runbook covers adding a new pre-built connector.

## Steps

### 1. Create the connector file

Create `packages/services/tenant-service/src/connectors/{system-name}.connector.ts`

Follow the pattern of `toast.connector.ts`:
- `testConnection(credentials)` — returns `{ ok: boolean, message: string }`
- `fetchData(credentials, startDate)` — returns normalized data
- `syncToKafka(tenantId, ...)` — publishes to appropriate Kafka topic

### 2. Register in onboarding wizard

Add to `DATA_SOURCES` in `packages/frontend/src/pages/OnboardingPage.tsx`:
```typescript
{ id: 'your_system', label: 'Your System', category: 'POS' }
```

### 3. Add to provisioning service

Register in `provisioningService.testDataSourceConnections()` to route test jobs.

### 4. Add connection config UI

For OAuth connectors: add redirect URL and client credential fields in settings page.
For API key connectors: add the API key field.

### 5. Test

1. Add to a local dev tenant via onboarding wizard
2. Verify data flows to Kafka (check Kafka UI at localhost:8080)
3. Verify data appears in relevant service database
4. Verify Socket.io emits real-time updates to frontend

### 6. Document the connector

Add to the connector library table in the onboarding Step 2 documentation.
