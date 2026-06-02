import axios from 'axios';
import { UserRole } from '@venueiq/shared-types';
import { logger } from '@venueiq/shared-utils';

const CLERK_API = 'https://api.clerk.com/v1';
const headers = { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' };

export const clerkService = {
  async inviteUsers(
    tenantId: string,
    invites: Array<{ email: string; role: UserRole | string }>,
  ) {
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const invite of invites) {
      try {
        await axios.post(
          `${CLERK_API}/invitations`,
          {
            email_address: invite.email,
            public_metadata: { tenant_id: tenantId, role: invite.role },
            redirect_url: `${process.env.FRONTEND_URL}/accept-invite`,
          },
          { headers },
        );
        results.push({ email: invite.email, status: 'sent' });
      } catch (err: any) {
        logger.error({ err, email: invite.email }, 'Failed to send Clerk invite');
        results.push({ email: invite.email, status: 'failed', error: err.message });
      }
    }

    return results;
  },

  async getUserMetadata(userId: string) {
    const resp = await axios.get(`${CLERK_API}/users/${userId}`, { headers });
    return resp.data.public_metadata;
  },

  async updateUserMetadata(userId: string, metadata: Record<string, unknown>) {
    await axios.patch(
      `${CLERK_API}/users/${userId}/metadata`,
      { public_metadata: metadata },
      { headers },
    );
  },

  async listTenantUsers(tenantId: string) {
    const resp = await axios.get(`${CLERK_API}/users?limit=100`, { headers });
    return (resp.data as any[]).filter(
      (u) => u.public_metadata?.tenant_id === tenantId,
    );
  },
};
