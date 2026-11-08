import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/server/db";

export const SMS_SEND_EVENT = "sms.send";
export const SMS_RECEIVE_EVENT = "sms.receive";

export async function smsAccess(userId: string) {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, channel: "SMS", eventType: { in: [SMS_SEND_EVENT, SMS_RECEIVE_EVENT] } },
  });
  const send = rows.find((row) => row.eventType === SMS_SEND_EVENT);
  const receive = rows.find((row) => row.eventType === SMS_RECEIVE_EVENT);
  return {
    send: send ? send.enabled : true,
    receive: receive ? receive.enabled : true,
  };
}

export async function setSmsAccess(userId: string, next: { send?: boolean; receive?: boolean }) {
  const writes: Array<{ eventType: string; channel: NotificationChannel; enabled: boolean }> = [];
  if (next.send !== undefined) {
    writes.push({ eventType: SMS_SEND_EVENT, channel: "SMS", enabled: next.send });
    writes.push({ eventType: "job.status", channel: "SMS", enabled: next.send });
    writes.push({ eventType: "wallet.movement", channel: "SMS", enabled: next.send });
  }
  if (next.receive !== undefined) {
    writes.push({ eventType: SMS_RECEIVE_EVENT, channel: "SMS", enabled: next.receive });
  }
  await Promise.all(
    writes.map((row) =>
      prisma.notificationPreference.upsert({
        where: { userId_eventType_channel: { userId, eventType: row.eventType, channel: row.channel } },
        create: { userId, eventType: row.eventType, channel: row.channel, enabled: row.enabled },
        update: { enabled: row.enabled },
      }),
    ),
  );
}
