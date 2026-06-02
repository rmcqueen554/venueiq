import axios from 'axios';
import { NotificationRequest } from '@venueiq/shared-types';
import { logger } from './logger';

// ── Teams webhook ─────────────────────────────────────────────────────────
export async function sendTeamsNotification(
  webhookUrl: string,
  req: Pick<NotificationRequest, 'title' | 'body' | 'severity' | 'action_url'>,
): Promise<void> {
  const colorMap: Record<string, string> = {
    critical: 'E85F4A',
    high: 'F5C96A',
    medium: '5B9CF6',
    low: '3FBF7A',
    info: '5B9CF6',
  };
  const themeColor = colorMap[req.severity ?? 'info'] ?? '5B9CF6';

  const card = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: req.title,
    sections: [
      {
        activityTitle: `**${req.title}**`,
        activitySubtitle: req.body,
        facts: req.severity ? [{ name: 'Severity', value: req.severity.toUpperCase() }] : [],
      },
    ],
    ...(req.action_url
      ? {
          potentialAction: [
            { '@type': 'OpenUri', name: 'View in VenueIQ', targets: [{ os: 'default', uri: req.action_url }] },
          ],
        }
      : {}),
  };

  await axios.post(webhookUrl, card, { timeout: 5000 });
}

// ── Slack webhook ─────────────────────────────────────────────────────────
export async function sendSlackNotification(
  webhookUrl: string,
  req: Pick<NotificationRequest, 'title' | 'body' | 'severity' | 'action_url'>,
): Promise<void> {
  const emojiMap: Record<string, string> = {
    critical: ':red_circle:',
    high: ':large_yellow_circle:',
    medium: ':large_blue_circle:',
    low: ':large_green_circle:',
    info: ':information_source:',
  };
  const emoji = emojiMap[req.severity ?? 'info'] ?? ':information_source:';

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} ${req.title}` } },
    { type: 'section', text: { type: 'mrkdwn', text: req.body } },
  ];
  if (req.action_url) {
    blocks.push({
      type: 'actions',
      elements: [{ type: 'button', text: { type: 'plain_text', text: 'View in VenueIQ' }, url: req.action_url }],
    });
  }

  await axios.post(webhookUrl, { blocks }, { timeout: 5000 });
}

// ── Dispatch notification to correct channel ──────────────────────────────
export async function dispatchNotification(
  req: NotificationRequest,
  tenantConfig: { teams_webhook?: string; slack_webhook?: string },
): Promise<void> {
  const log = logger.child({ tenant_id: req.tenant_id, channel: req.channel });

  try {
    if (req.channel === 'teams' && tenantConfig.teams_webhook) {
      await sendTeamsNotification(tenantConfig.teams_webhook, req);
    } else if (req.channel === 'slack' && tenantConfig.slack_webhook) {
      await sendSlackNotification(tenantConfig.slack_webhook, req);
    }
    log.info({ title: req.title }, 'Notification dispatched');
  } catch (err) {
    log.error({ err }, 'Failed to dispatch notification');
  }
}
