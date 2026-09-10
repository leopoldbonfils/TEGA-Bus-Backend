import prisma from '../config/database';
import { socketService } from './socket.service';
import { env } from '../config/env';

export type AlertType = 'GENERAL' | 'SERVICE_ALERT' | 'BUS_APPROACHING' | 'DELAY' | 'ROUTE_UPDATE';

export interface CreateAlertInput {
  title: string;
  message: string;
  type?: AlertType;
  routeId?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

async function sendExpoNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    .map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      channelId: 'tega-alerts',
    }));

  if (messages.length === 0) return;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    if (env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    }

    const BATCH = 100;
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(` Expo push batch failed [${response.status}]:`, text);
      } else {
        const result = await response.json() as { data?: unknown[] };
        console.log(` Expo push batch sent (${batch.length} messages):`, result?.data?.length ?? '?', 'receipts');
      }
    }
  } catch (err) {
    console.error('Failed to send Expo push notifications:', err);
  }
}

export const alertService = {
  async createAlert(input: CreateAlertInput) {
    const alert = await prisma.alert.create({
      data: {
        title: input.title,
        message: input.message,
        type: (input.type ?? 'GENERAL') as AlertType,
        routeId: input.routeId ?? null,
      },
      include: { route: { select: { id: true, name: true } } },
    });

    // 1. Real-time broadcast to all connected Socket.IO clients
    socketService.emit('new:alert', alert);
    console.log(`📢 Alert created & broadcast: [${alert.type}] ${alert.title}`);

    // 2. Push notifications collect all registered tokens
    try {
      const pushTokenRecords = await prisma.pushToken.findMany({
        select: { token: true },
      });
      const tokens = pushTokenRecords.map((r) => r.token);

      if (tokens.length > 0) {
        await sendExpoNotifications(tokens, `TEGA Bus`, alert.message, {
          alertId: alert.id,
          screen: 'notifications',
        });
      } else {
        console.log('No push tokens registered — skipping push notifications');
      }
    } catch (pushErr) {
      console.error('Push token fetch failed:', pushErr);
    }

    return alert;
  },

  async getAlerts(limit = 50) {
    return prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { route: { select: { id: true, name: true } } },
    });
  },
};
