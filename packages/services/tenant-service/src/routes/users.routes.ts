import { FastifyInstance } from 'fastify';
import { createPrismaClient } from '@venueiq/shared-utils';
import { clerkService } from '../services/clerk.service';

const prisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

export async function userRoutes(app: FastifyInstance) {
  // List users for tenant
  app.get('/:tenant_id', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const users = await prisma.tenantUser.findMany({
      where: { tenant_id },
      orderBy: { invited_at: 'desc' },
    });
    return { success: true, data: users };
  });

  // Invite user
  app.post('/:tenant_id/invite', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const { email, role } = request.body as any;

    const results = await clerkService.inviteUsers(tenant_id, [{ email, role }]);

    // Record invite in DB
    await prisma.tenantUser.create({
      data: { tenant_id, user_id: `pending_${email}`, role, permissions: {} },
    });

    return reply.status(201).send({ success: true, data: results[0] });
  });

  // Update user role
  app.patch('/:tenant_id/:user_id/role', async (request, reply) => {
    const { tenant_id, user_id } = request.params as any;
    const { role, permissions } = request.body as any;

    const updated = await prisma.tenantUser.update({
      where: { tenant_id_user_id: { tenant_id, user_id } },
      data: { role, permissions: permissions ?? {} },
    });

    await clerkService.updateUserMetadata(user_id, { tenant_id, role });
    return { success: true, data: updated };
  });

  // Remove user from tenant
  app.delete('/:tenant_id/:user_id', async (request, reply) => {
    const { tenant_id, user_id } = request.params as any;
    await prisma.tenantUser.delete({
      where: { tenant_id_user_id: { tenant_id, user_id } },
    });
    return { success: true };
  });
}
