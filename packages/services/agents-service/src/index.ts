import { Worker } from 'bullmq';
import { getRedis, logger, subscribeAndProcess, createConsumer, KAFKA_TOPICS } from '@venueiq/shared-utils';
import { agentRunner } from './agent-runner';
import { scheduleAllAgents } from './jobs/schedule-all-agents.job';

async function bootstrap() {
  logger.info('Starting VenueIQ Agents Service');

  // Start CRON-based agent scheduling
  await scheduleAllAgents();

  // BullMQ worker — processes agent execution jobs
  if (process.env.REDIS_URL) {
    const worker = new Worker(
      'agent-tasks',
      async (job) => {
        const { agent_name, tenant_id, event_id, payload } = job.data;
        await agentRunner.run({ agent_name, tenant_id, event_id, payload });
      },
      {
        connection: getRedis(),
        concurrency: 10,
        limiter: { max: 50, duration: 60_000 },
      },
    );

    worker.on('completed', (job) => {
      logger.info({ job_id: job.id, agent: job.data.agent_name, tenant: job.data.tenant_id }, 'Agent job completed');
    });

    worker.on('failed', (job, err) => {
      logger.error({ job_id: job?.id, err }, 'Agent job failed');
    });
  } else {
    logger.warn('REDIS_URL not set — BullMQ worker disabled, CRON-only mode');
  }

  // Kafka consumer — event-triggered agents (optional)
  if (process.env.KAFKA_ENABLED !== 'false') {
    const consumer = createConsumer('venueiq-agents');
    await subscribeAndProcess(
      consumer,
      [KAFKA_TOPICS.MODULE_KPI_SNAPSHOTS, KAFKA_TOPICS.SECURITY_INCIDENTS, KAFKA_TOPICS.AGENT_OUTPUTS],
      async (topic, _key, value: any) => {
        if (topic === KAFKA_TOPICS.SECURITY_INCIDENTS && value.severity === 'critical') {
          await agentRunner.run({ agent_name: 'security_agent', tenant_id: value.tenant_id, event_id: value.event_id, payload: value });
        }
        if (topic === KAFKA_TOPICS.MODULE_KPI_SNAPSHOTS) {
          await agentRunner.run({ agent_name: 'coo_agent', tenant_id: value.tenant_id, event_id: value.event_id, payload: value });
        }
      },
    );
  }

  logger.info('Agents Service running — all agents active');
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start agents-service');
  process.exit(1);
});
