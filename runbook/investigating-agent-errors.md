# Investigating AI Agent Errors

## Common Issues

### 1. Agent not running for a tenant

```bash
# Check BullMQ queue health
kubectl exec -n venueiq-services deployment/agents-service -- \
  node -e "const {Queue} = require('bullmq'); const q = new Queue('agent-tasks', {connection: {url: process.env.REDIS_URL}}); q.getJobCounts().then(console.log)"

# Check agent schedule in DB
psql $AGENTS_DATABASE_URL -c "SELECT * FROM agent_schedules WHERE tenant_id = '{tenant_id}';"
```

### 2. Claude API errors

All Claude API calls are logged in `claude_api_call_logs` table.

```sql
-- Find failing calls in last hour
SELECT service, error, COUNT(*) 
FROM claude_api_call_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND error IS NOT NULL
GROUP BY service, error;
```

Common causes:
- Rate limiting: check token usage in Claude Console
- Context too large: reduce KPI data payload in prompt
- Network timeout: check VPC routing to api.anthropic.com

### 3. Agent outputs not showing in dashboard

```sql
-- Check recent agent outputs for tenant
SELECT agent_name, output_type, severity, title, created_at 
FROM agent_outputs 
WHERE tenant_id = '{tenant_id}'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

### 4. Cost monitoring

```sql
-- Total Claude API cost by tenant by day
SELECT 
  tenant_id,
  DATE(created_at) as date,
  SUM(cost_usd) as total_cost_usd,
  SUM(input_tokens + output_tokens) as total_tokens,
  COUNT(*) as api_calls
FROM claude_api_call_logs
GROUP BY tenant_id, DATE(created_at)
ORDER BY date DESC, total_cost_usd DESC;
```
