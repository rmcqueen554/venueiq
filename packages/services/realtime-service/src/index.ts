import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createConsumer, subscribeAndProcess, KAFKA_TOPICS, logger } from '@venueiq/shared-utils';
import type { PosTransactionEvent, GateScanEvent, ParkingEntryEvent, SecurityIncidentEvent, IoTSensorReadingEvent, AgentOutputEvent } from '@venueiq/shared-types';

const httpServer = createServer();

const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL ?? '*', credentials: true },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
});

// ── Socket.io rooms by tenant ─────────────────────────────────────────────
io.on('connection', (socket) => {
  const tenantId = socket.handshake.auth.tenant_id as string;
  const userRole = socket.handshake.auth.role as string;

  if (!tenantId) {
    socket.disconnect(true);
    return;
  }

  // Join tenant-scoped room
  socket.join(`tenant:${tenantId}`);
  logger.info({ tenant_id: tenantId, role: userRole, socket_id: socket.id }, 'Client connected');

  socket.on('disconnect', () => {
    logger.info({ tenant_id: tenantId, socket_id: socket.id }, 'Client disconnected');
  });
});

// ── Kafka → Socket.io fan-out ─────────────────────────────────────────────
function emitToTenant(tenantId: string, event: string, data: unknown) {
  io.to(`tenant:${tenantId}`).emit(event, data);
}

async function startKafkaConsumers() {
  const consumer = createConsumer('venueiq-realtime-service');

  await subscribeAndProcess(
    consumer,
    [
      KAFKA_TOPICS.POS_TRANSACTIONS,
      KAFKA_TOPICS.GATE_SCANS,
      KAFKA_TOPICS.PARKING_ENTRIES,
      KAFKA_TOPICS.SECURITY_INCIDENTS,
      KAFKA_TOPICS.IOT_SENSOR_READINGS,
      KAFKA_TOPICS.AGENT_OUTPUTS,
      KAFKA_TOPICS.MODULE_KPI_SNAPSHOTS,
    ],
    async (topic, _key, value: any) => {
      const tenantId = value.tenant_id;
      if (!tenantId) return;

      switch (topic) {
        case KAFKA_TOPICS.POS_TRANSACTIONS:
          emitToTenant(tenantId, 'pos:transaction', {
            stand_id: value.stand_id,
            total: value.total,
            items: value.items,
            occurred_at: value.occurred_at,
          });
          break;

        case KAFKA_TOPICS.GATE_SCANS:
          emitToTenant(tenantId, 'security:gate_scan', {
            gate_id: value.gate_id,
            gate_name: value.gate_name,
            scan_type: value.scan_type,
            occurred_at: value.occurred_at,
          });
          break;

        case KAFKA_TOPICS.PARKING_ENTRIES:
          emitToTenant(tenantId, 'parking:entry', {
            lot_id: value.lot_id,
            entry_type: value.entry_type,
            occurred_at: value.occurred_at,
          });
          break;

        case KAFKA_TOPICS.SECURITY_INCIDENTS:
          emitToTenant(tenantId, 'security:incident', {
            incident_id: value.incident_id,
            type: value.incident_type,
            severity: value.severity,
            location: value.location_description,
            occurred_at: value.occurred_at,
          });
          break;

        case KAFKA_TOPICS.IOT_SENSOR_READINGS:
          emitToTenant(tenantId, 'facilities:sensor', {
            asset_id: value.asset_id,
            metric_name: value.metric_name,
            value: value.value,
            unit: value.unit,
            occurred_at: value.occurred_at,
          });
          break;

        case KAFKA_TOPICS.AGENT_OUTPUTS:
          emitToTenant(tenantId, 'agent:output', {
            agent_name: value.agent_name,
            output_type: value.output_type,
            severity: value.severity,
            title: value.title,
            requires_approval: value.requires_approval,
          });
          break;

        case KAFKA_TOPICS.MODULE_KPI_SNAPSHOTS:
          emitToTenant(tenantId, 'kpi:snapshot', {
            module: value.module,
            kpis: value.kpis,
            snapshot_at: value.snapshot_at,
          });
          break;
      }
    },
  );
}

const PORT = parseInt(process.env.PORT ?? '3013');
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Realtime service (Socket.io) started');
  if (process.env.KAFKA_ENABLED !== 'false') {
    startKafkaConsumers().catch((err) => logger.error({ err }, 'Kafka consumer failed to start'));
  } else {
    logger.info('Kafka disabled — Socket.io running without event stream');
  }
});
