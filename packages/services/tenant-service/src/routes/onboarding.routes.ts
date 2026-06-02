import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPrismaClient } from '@venueiq/shared-utils';
import { provisioningService } from '../services/provisioning.service';
import { stripeService } from '../services/stripe.service';
import { clerkService } from '../services/clerk.service';

const prisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

// Zod schemas for each onboarding step
const step1Schema = z.object({
  name: z.string().min(2),
  type: z.enum(['stadium', 'arena', 'amphitheater', 'civic_center', 'racetrack', 'fairground', 'convention_center']),
  capacity: z.number().int().positive().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  timezone: z.string(),
  sport_or_genre: z.string().optional(),
  num_concession_stands: z.number().int().optional(),
  num_parking_lots: z.number().int().optional(),
  num_gates: z.number().int().optional(),
  logo_url: z.string().url().optional(),
});

const step2Schema = z.object({
  data_sources: z.array(z.object({
    source_type: z.string(),
    credentials: z.record(z.unknown()),
    config: z.record(z.unknown()).optional(),
  })),
});

const step3Schema = z.object({
  events: z.array(z.object({
    name: z.string(),
    type: z.enum(['game', 'concert', 'convention', 'private', 'rehearsal']),
    scheduled_at: z.string().datetime(),
    gates_open_at: z.string().datetime().optional(),
    expected_attendance: z.number().int().optional(),
    opponent_or_artist: z.string().optional(),
    recurring: z.boolean().optional(),
    recurrence_pattern: z.string().optional(),
  })),
});

const step4Schema = z.object({
  invites: z.array(z.object({
    email: z.string().email(),
    role: z.string(),
  })),
});

const step6Schema = z.object({
  preferred_channel: z.enum(['teams', 'slack']),
  teams_webhook: z.string().url().optional(),
  slack_webhook: z.string().url().optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  sms_phone: z.string().optional(),
});

export async function onboardingRoutes(app: FastifyInstance) {
  // Step 1: Venue Profile
  app.post('/step/1', async (request, reply) => {
    const user = (request as any).auth;
    const body = step1Schema.parse(request.body);

    // Create or update tenant
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existingProgress = await prisma.onboardingProgress.findFirst({
      where: { /* find by clerk user */ },
    });

    const tenant = await prisma.tenant.upsert({
      where: { slug },
      create: {
        name: body.name,
        slug: `${slug}-${Date.now()}`,
        type: body.type,
        capacity: body.capacity,
        timezone: body.timezone,
        tier: 'starter',
        white_label_config: body.logo_url ? { logo_url: body.logo_url, primary_color: '#E8A838', app_name: 'VenueIQ', favicon_url: null } : null,
      },
      update: {
        name: body.name,
        type: body.type,
        capacity: body.capacity,
        timezone: body.timezone,
        white_label_config: body.logo_url ? { logo_url: body.logo_url, primary_color: '#E8A838', app_name: 'VenueIQ', favicon_url: null } : null,
      },
    });

    // Create venue record
    await prisma.venue.upsert({
      where: { id: tenant.id },
      create: {
        tenant_id: tenant.id,
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        layout_config: {
          width: 1000,
          height: 800,
          sections: [],
          gates: [],
          concession_stands: [],
          merch_locations: [],
          parking_lots: [],
        },
      },
      update: { address: body.address, city: body.city, state: body.state },
    });

    // Save onboarding progress
    await prisma.onboardingProgress.upsert({
      where: { tenant_id: tenant.id },
      create: { tenant_id: tenant.id, step: 1, step_data: body },
      update: { step: 1, step_data: body },
    });

    return reply.send({ success: true, data: { tenant_id: tenant.id, slug: tenant.slug } });
  });

  // Step 2: Data Source Connections
  app.post('/step/2', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = step2Schema.parse(request.body);

    for (const source of body.data_sources) {
      await prisma.tenantDataSource.upsert({
        where: { tenant_id_source_type: { tenant_id, source_type: source.source_type } },
        create: {
          tenant_id,
          source_type: source.source_type,
          credentials: source.credentials,
          config: source.config ?? {},
          status: 'pending',
        },
        update: {
          credentials: source.credentials,
          config: source.config ?? {},
          status: 'pending',
        },
      });
    }

    // Kick off async connection tests
    await provisioningService.testDataSourceConnections(tenant_id, body.data_sources);

    await prisma.onboardingProgress.update({
      where: { tenant_id },
      data: { step: 2, step_data: { source_types: body.data_sources.map((s) => s.source_type) } },
    });

    return reply.send({ success: true, data: { sources_queued: body.data_sources.length } });
  });

  // Step 3: Event Calendar
  app.post('/step/3', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = step3Schema.parse(request.body);

    // Get venue for this tenant
    const venue = await prisma.venue.findFirst({ where: { tenant_id } });
    if (!venue) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Venue not found' } });

    const created = await Promise.all(
      body.events.map((e) =>
        prisma.event.create({
          data: {
            tenant_id,
            venue_id: venue.id,
            name: e.name,
            type: e.type,
            opponent_or_artist: e.opponent_or_artist,
            scheduled_at: new Date(e.scheduled_at),
            gates_open_at: e.gates_open_at ? new Date(e.gates_open_at) : undefined,
            expected_attendance: e.expected_attendance,
            status: 'scheduled',
          },
        }),
      ),
    );

    await prisma.onboardingProgress.update({
      where: { tenant_id },
      data: { step: 3, step_data: { events_created: created.length } },
    });

    return reply.send({ success: true, data: { events_created: created.length } });
  });

  // Step 4: User Invites
  app.post('/step/4', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = step4Schema.parse(request.body);

    const results = await clerkService.inviteUsers(tenant_id, body.invites);

    await prisma.onboardingProgress.update({
      where: { tenant_id },
      data: { step: 4, step_data: { invites_sent: body.invites.length } },
    });

    return reply.send({ success: true, data: results });
  });

  // Step 5: Historical Data Upload
  app.post('/step/5/upload', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const data = await (request as any).file();

    if (!data) return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } });

    const s3Key = `${tenant_id}/historical/${data.filename}-${Date.now()}`;
    await provisioningService.uploadHistoricalData(tenant_id, s3Key, data.file, data.filename);

    await prisma.onboardingProgress.update({
      where: { tenant_id },
      data: { step: 5, step_data: { upload_key: s3Key } },
    });

    return reply.send({ success: true, data: { s3_key: s3Key, status: 'processing' } });
  });

  // Step 6: Notification Preferences
  app.post('/step/6', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = step6Schema.parse(request.body);

    await prisma.notificationConfig.upsert({
      where: { tenant_id },
      create: {
        tenant_id,
        preferred_channel: body.preferred_channel,
        teams_webhook: body.teams_webhook,
        slack_webhook: body.slack_webhook,
        email_enabled: body.email_enabled ?? true,
        sms_enabled: body.sms_enabled ?? false,
      },
      update: {
        preferred_channel: body.preferred_channel,
        teams_webhook: body.teams_webhook,
        slack_webhook: body.slack_webhook,
        email_enabled: body.email_enabled ?? true,
        sms_enabled: body.sms_enabled ?? false,
      },
    });

    await prisma.onboardingProgress.update({
      where: { tenant_id },
      data: { step: 6, step_data: { channel: body.preferred_channel } },
    });

    return reply.send({ success: true });
  });

  // Step 7: Go Live — system health check + activate
  app.post('/step/7/go-live', async (request, reply) => {
    const { tenant_id } = request.params as any;

    const healthReport = await provisioningService.runSystemHealthCheck(tenant_id);

    if (healthReport.overall === 'ready') {
      await prisma.tenant.update({
        where: { id: tenant_id },
        data: { onboarding_completed_at: new Date() },
      });
      await prisma.onboardingProgress.update({
        where: { tenant_id },
        data: { step: 7, completed: true },
      });
      await provisioningService.activateAiAgents(tenant_id);
    }

    return reply.send({ success: true, data: healthReport });
  });

  // Get current onboarding status
  app.get('/:tenant_id/status', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const progress = await prisma.onboardingProgress.findUnique({ where: { tenant_id } });
    return reply.send({ success: true, data: progress });
  });
}
