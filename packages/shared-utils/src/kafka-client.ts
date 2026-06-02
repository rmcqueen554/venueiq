import { Kafka, Producer, Consumer, CompressionTypes, logLevel } from 'kafkajs';
import { KAFKA_TOPICS, KafkaTopic } from '@venueiq/shared-types';
import { logger } from './logger';

let kafka: Kafka | null = null;

function getKafka(): Kafka {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
    const ssl = process.env.KAFKA_SSL === 'true';

    kafka = new Kafka({
      clientId: `venueiq-${process.env.SERVICE_NAME ?? 'unknown'}`,
      brokers,
      ssl,
      ...(process.env.KAFKA_SASL_USERNAME
        ? {
            sasl: {
              mechanism: 'scram-sha-512',
              username: process.env.KAFKA_SASL_USERNAME!,
              password: process.env.KAFKA_SASL_PASSWORD!,
            },
          }
        : {}),
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 10 },
    });
  }
  return kafka;
}

// ── Producer ──────────────────────────────────────────────────────────────
let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafka().producer({ allowAutoTopicCreation: true });
    await producer.connect();
    logger.info('Kafka producer connected');
  }
  return producer;
}

export async function publishEvent<T>(
  topic: KafkaTopic,
  key: string,
  value: T,
): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

export async function publishBatch<T>(
  topic: KafkaTopic,
  messages: Array<{ key: string; value: T }>,
): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: messages.map((m) => ({ key: m.key, value: JSON.stringify(m.value) })),
  });
}

// ── Consumer factory ──────────────────────────────────────────────────────
export function createConsumer(groupId: string): Consumer {
  return getKafka().consumer({ groupId, sessionTimeout: 30000, heartbeatInterval: 3000 });
}

export async function subscribeAndProcess<T>(
  consumer: Consumer,
  topics: KafkaTopic[],
  handler: (topic: string, key: string, value: T) => Promise<void>,
): Promise<void> {
  await consumer.connect();
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, message }) => {
      try {
        const key = message.key?.toString() ?? '';
        const value = JSON.parse(message.value?.toString() ?? '{}') as T;
        await handler(topic, key, value);
      } catch (err) {
        logger.error({ err, topic }, 'Failed to process Kafka message');
      }
    },
  });
}

export { KAFKA_TOPICS };
